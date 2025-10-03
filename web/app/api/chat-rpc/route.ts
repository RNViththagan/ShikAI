import { NextRequest, NextResponse } from "next/server";
import { RpcServer } from "@shared/rpc";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  RpcContext,
} from "@shared/rpc/types";

// Create a singleton RPC server instance
let rpcServer: RpcServer | null = null;

function getRpcServer(): RpcServer {
  if (!rpcServer) {
    rpcServer = new RpcServer();
  }
  return rpcServer;
}

// Check if this is a streaming RPC method
function isStreamingMethod(method: string): boolean {
  return method === "ai.streamText" || method.startsWith("stream.");
}

/**
 * Handle streaming RPC methods that return Server-Sent Events
 */
async function handleStreamingRPC(
  rpcRequest: JsonRpcRequest,
  request: NextRequest
): Promise<Response> {
  console.log(
    "🌊 Streaming RPC Request:",
    rpcRequest.method,
    rpcRequest.params
  );

  // Create RPC context from request
  const context: RpcContext = {
    clientInfo: {
      userAgent: request.headers.get("user-agent") || undefined,
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  };

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial RPC response indicating streaming started
      const initialResponse = {
        jsonrpc: "2.0" as const,
        result: {
          streaming: true,
          method: rpcRequest.method,
          streamId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          model: "claude-3-5-sonnet-20241022",
        },
        id: rpcRequest.id,
      };

      // Send initial response as SSE
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "rpc-response",
            data: initialResponse,
          })}\n\n`
        )
      );

      try {
        // Use the RPC server to handle the method call properly
        const server = getRpcServer();
        console.log("🎯 Calling RPC method through server:", rpcRequest.method);

        // Call the RPC method handler which returns the stream result
        const methodResult = await server.handleRequest(rpcRequest, context);

        if (methodResult.error) {
          throw new Error(methodResult.error.message);
        }

        const result = methodResult.result as any;
        console.log("✅ RPC method returned:", result.type);

        if (result.type === "ui_stream_response" && result.uiStreamResponse) {
          console.log("🌊 Processing UI message stream response from RPC method");
          console.log("📦 UI Stream Response received:", result.uiStreamResponse);

          // The uiStreamResponse is a Response object with a readable stream
          const uiResponse = result.uiStreamResponse;
          console.log("🔍 UI Response body:", uiResponse.body);
          console.log("🔍 UI Response headers:", Array.from(uiResponse.headers.entries()));

          if (uiResponse.body) {
            const reader = uiResponse.body.getReader();
            const decoder = new TextDecoder();

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                console.log("🌊 UI Stream chunk received:", chunk);

                // Send the UI stream chunk as SSE with RPC structure
                const chunkData = {
                  type: "ui-stream-chunk",
                  data: {
                    jsonrpc: "2.0" as const,
                    method: rpcRequest.method,
                    params: {
                      uiChunk: chunk,
                      timestamp: new Date().toISOString(),
                    },
                    id: rpcRequest.id,
                  },
                };

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
                );
              }
            } finally {
              reader.releaseLock();
            }
          } else {
            throw new Error("UI Stream response has no body");
          }

          console.log("✅ Stream completed successfully");

          // Send final completion message
          const finalData = {
            type: "stream-complete",
            data: {
              jsonrpc: "2.0" as const,
              result: {
                completed: true,
                method: rpcRequest.method,
                timestamp: new Date().toISOString(),
                model: result.model,
                messageCount: result.messageCount,
                maxSteps: result.maxSteps,
              },
              id: rpcRequest.id,
            },
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`)
          );
        } else {
          throw new Error("Invalid stream result from RPC method");
        }
      } catch (error: any) {
        console.error("❌ Streaming RPC Error:", error);

        // Send error as SSE
        const errorData = {
          type: "stream-error",
          data: {
            jsonrpc: "2.0" as const,
            error: {
              code: -32603,
              message: error.message || "Streaming failed",
            },
            id: rpcRequest.id,
          },
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * Handle JSON RPC requests via POST
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse | Response> {
  try {
    const body = await request.json();
    console.log("📡 JSON RPC Request received:", body);

    // Check if this is a streaming method request
    if (!Array.isArray(body) && body.method && isStreamingMethod(body.method)) {
      return handleStreamingRPC(body as JsonRpcRequest, request);
    }

    // Create RPC context from request
    const context: RpcContext = {
      clientInfo: {
        userAgent: request.headers.get("user-agent") || undefined,
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    };

    const server = getRpcServer();

    // Handle single request or batch
    let response: JsonRpcResponse | JsonRpcResponse[];

    if (Array.isArray(body)) {
      // Batch request
      response = await server.handleBatchRequest(
        body as JsonRpcRequest[],
        context
      );
    } else {
      // Single request
      response = await server.handleRequest(body as JsonRpcRequest, context);
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    console.error("❌ JSON RPC Error:", error);

    // Return a proper JSON RPC error response
    const errorResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      error: {
        code: -32700, // Parse error
        message: error.message || "Internal server error",
        data: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      id: null,
    };

    return NextResponse.json(errorResponse, {
      status: 200, // JSON RPC errors are still HTTP 200
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
}

/**
 * Handle OPTIONS for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

/**
 * Handle GET for method discovery and health checks
 */
export async function GET(): Promise<NextResponse> {
  try {
    const server = getRpcServer();

    const info = {
      server: "ShikAI JSON RPC Server",
      version: "1.0.0",
      jsonrpc: "2.0",
      methods: server.getAllMethodsInfo(),
      endpoints: {
        rpc: "/api/chat-rpc",
        health: "/api/chat-rpc?ping=true",
      },
    };

    return NextResponse.json(info, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("❌ JSON RPC GET Error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error.message,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

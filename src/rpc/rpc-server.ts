import { RpcManager } from "./rpc-manager";
import { AIRpcMethods } from "./ai-methods";
import { JsonRpcRequest, JsonRpcResponse, RpcContext } from "./types";

/**
 * Main RPC Server - Orchestrates all RPC functionality
 */
export class RpcServer {
  private rpcManager: RpcManager;
  private aiMethods: AIRpcMethods;

  constructor() {
    this.rpcManager = new RpcManager();
    this.aiMethods = new AIRpcMethods();
    this.registerAllMethods();
  }

  /**
   * Register all available RPC methods
   */
  private registerAllMethods(): void {
    // Register AI methods
    const aiMethods = this.aiMethods.getMethods();
    aiMethods.forEach((method) => {
      this.rpcManager.registerMethod(method);
    });

    // Register introspection methods
    this.registerIntrospectionMethods();

    console.log(
      `🚀 RPC Server initialized with ${
        this.rpcManager.getRegisteredMethods().length
      } methods`
    );
  }

  /**
   * Register basic system methods for debugging
   */
  private registerIntrospectionMethods(): void {
    // Simple health check
    this.rpcManager.registerMethod({
      name: "system.ping",
      handler: () => {
        return {
          status: "ok",
          timestamp: new Date().toISOString(),
          server: "ShikAI Simple RPC Server",
        };
      },
      description: "Health check endpoint",
    });
  }

  /**
   * Handle a single RPC request
   */
  async handleRequest(
    request: JsonRpcRequest,
    context?: RpcContext
  ): Promise<JsonRpcResponse> {
    console.log(
      `📡 RPC Request: ${request.method}`,
      request.params ? "(with params)" : "(no params)"
    );

    const startTime = Date.now();
    const response = await this.rpcManager.handleRequest(request, context);
    const duration = Date.now() - startTime;

    console.log(
      `✅ RPC Response: ${request.method} (${duration}ms)`,
      response.error ? "❌" : "✅"
    );

    return response;
  }

  /**
   * Handle batch RPC requests
   */
  async handleBatchRequest(
    requests: JsonRpcRequest[],
    context?: RpcContext
  ): Promise<JsonRpcResponse[]> {
    console.log(`📦 RPC Batch Request: ${requests.length} requests`);

    const startTime = Date.now();
    const responses = await this.rpcManager.handleBatchRequest(
      requests,
      context
    );
    const duration = Date.now() - startTime;

    console.log(
      `✅ RPC Batch Response: ${responses.length} responses (${duration}ms)`
    );

    return responses;
  }

  /**
   * Get all registered methods
   */
  getRegisteredMethods(): string[] {
    return this.rpcManager.getRegisteredMethods();
  }

  /**
   * Get method information
   */
  getMethodInfo(methodName: string) {
    return this.rpcManager.getMethodInfo(methodName);
  }

  /**
   * Get all methods information
   */
  getAllMethodsInfo() {
    return this.rpcManager.getAllMethodsInfo();
  }
}

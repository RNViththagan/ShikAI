import { z } from "zod";
import { AIService } from "../services/ai-service";
import { RpcMethodDefinition, RpcContext } from "./types";
import { tool } from "ai";
import { ToolsService } from "../services";
import * as readline from "readline";
// Simple parameter schema for text generation
const TextGenerationSchema = z.object({
  prompt: z.string(),
  maxTokens: z.number().optional().default(100),
});

// Parameter schema for streaming text generation
const StreamTextSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  maxSteps: z.number().optional().default(5),
});

/**
 * AI RPC Methods - Simple implementation with just one method for learning
 */
export class AIRpcMethods {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Get all AI-related RPC method definitions
   */
  getMethods(): RpcMethodDefinition[] {
    return [
      {
        name: "ai.generateText",
        handler: this.handleTextGeneration.bind(this),
        description: "Generate text from a prompt using AI service",
        paramsSchema: TextGenerationSchema,
      },
      {
        name: "ai.streamText",
        handler: this.handleStreamText.bind(this),
        description: "Stream text generation with conversation messages",
        paramsSchema: StreamTextSchema,
      },
    ];
  }

  /**
   * Handle text generation - This is the core method that calls the AI service
   */
  private async handleTextGeneration(
    params: z.infer<typeof TextGenerationSchema>,
    context?: RpcContext
  ) {
    try {
      console.log(
        "🤖 AI Text Generation RPC called with prompt:",
        params.prompt
      );

      // Call the AI service to generate text
      const result = await this.aiService.generateText(
        params.prompt,
        params.maxTokens
      );

      console.log("✅ AI Text Generation completed");

      // Return the result in a structured format
      return {
        text: result,
        prompt: params.prompt,
        maxTokens: params.maxTokens,
        model: "claude-3-5-sonnet-20241022", // This could come from config
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("🚨 AI Text Generation RPC error:", error);
      throw new Error(`Text generation failed: ${error.message}`);
    }
  }

  /**
   * Handle stream text generation - This streams text with conversation messages
   * Returns the actual stream result for the RPC server to handle
   */
  private async handleStreamText(
    params: z.infer<typeof StreamTextSchema>,
    context?: RpcContext
  ) {
    try {
      console.log(
        "🌊 AI Stream Text RPC called with",
        params.messages.length,
        "messages"
      );
      // Extract tools from context if available
      const toolsService = new ToolsService();
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const tools = toolsService.getAllTools(rl);

      // Call the AI service to stream text and return the stream result directly
      const response = await this.aiService.streamText(
        params.messages as any[], // Cast to ModelMessage[] - the AI service will handle it
        tools,
        params.maxSteps
      );

      console.log("✅ AI Stream Text initiated, creating UI message stream response");

      // Convert to UI message stream response
      const uiStreamResponse = response.toUIMessageStreamResponse();
      console.log("🎯 UI Message Stream Response created:", uiStreamResponse);
      console.log("🔍 Response headers:", uiStreamResponse.headers);
      console.log("📦 Response status:", uiStreamResponse.status);

      // Return the UI message stream response for the RPC server to handle
      return {
        type: "ui_stream_response",
        uiStreamResponse: uiStreamResponse,
        messageCount: params.messages.length,
        maxSteps: params.maxSteps,
        model: "claude-3-5-sonnet-20241022",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("🚨 AI Stream Text RPC error:", error);
      throw new Error(`Stream text generation failed: ${error.message}`);
    }
  }
}

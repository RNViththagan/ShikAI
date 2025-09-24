import { NextRequest } from "next/server";
import { CoreMessage } from "ai";

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    console.log("📡 Chat API:", messages.length, "messages");

    // Dynamic imports
    const { AIService } = await import("@shared/services/ai-service");
    const { WebToolsService } = await import("../../../src/tools");
    const { getAgentName, getMaxSteps } = await import(
      "@shared/config/app-config"
    );
    const { getPromptTemplate } = await import("@shared/config/prompts");

    const aiService = new AIService();
    const webToolsService = new WebToolsService();

    // Get configuration
    const AGENT_NAME = getAgentName();
    const MAX_STEPS = getMaxSteps();
    const PROMPT_TEMPLATE = process.env.PROMPT_TEMPLATE || "default";

    // Prepare messages with system prompt
    let conversationMessages: CoreMessage[] = [...messages];

    if (!messages.some((msg: CoreMessage) => msg.role === "system")) {
      const systemMessage: CoreMessage = {
        role: "system",
        content: getPromptTemplate(PROMPT_TEMPLATE, AGENT_NAME),
      };
      conversationMessages = [systemMessage, ...messages];
    }

    // Get web-safe tools
    let webTools: any[] = [];
    try {
      const safeToolKeys = ["askPermission", "executeCommand"];
      webTools = webToolsService.getToolsByKeys(safeToolKeys);
    } catch (error) {
      console.error("Error loading web tools:", error);
      webTools = [];
    }

    // Call AI service
    const result = await aiService.streamText(
      conversationMessages,
      webTools,
      MAX_STEPS
    );

    // Return text stream
    return new Response(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("❌ Chat API error:", error.message);
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}

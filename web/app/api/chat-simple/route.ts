import { NextRequest } from "next/server";
import { CoreMessage } from "ai";

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    console.log("📡 Simple AI API:", messages.length, "messages");

    // Dynamic imports
    const { AIService } = await import("@shared/services/ai-service");
    const { WebToolsService } = await import("../../../src/tools");
    const { getAgentName } = await import("@shared/config/app-config");
    const { getPromptTemplate } = await import("@shared/config/prompts");

    const aiService = new AIService();
    const webToolsService = new WebToolsService();

    // Get configuration
    const AGENT_NAME = getAgentName();
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

    // Create a simple prompt from messages
    const prompt = conversationMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    // Call generateText directly instead of streamText
    const response = await aiService.generateText(prompt, 1000);

    // Return simple JSON response
    return Response.json({
      content: response,
      role: "assistant",
    });
  } catch (error: any) {
    console.error("❌ Simple AI API error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

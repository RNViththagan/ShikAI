import { NextRequest } from "next/server";
import { ModelMessage } from "ai";

export async function POST(request: NextRequest) {
  try {
    const { messages, pendingApproval } = await request.json();
    console.log(
      "🛡️ Interactive AI API:",
      messages.length,
      "messages",
      pendingApproval ? "(with approval)" : ""
    );

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
    let conversationMessages: ModelMessage[] = [...messages];

    if (!messages.some((msg: ModelMessage) => msg.role === "system")) {
      const systemMessage: ModelMessage = {
        role: "system",
        content:
          getPromptTemplate(PROMPT_TEMPLATE, AGENT_NAME) +
          "\n\nIMPORTANT: This is an interactive web interface. Use 'interactiveAskPermission' tool for risky actions that need user approval. The user will see a permission dialog and can approve/deny your request.",
      };
      conversationMessages = [systemMessage, ...messages];
    }

    // If we have a pending approval, add it as context
    if (pendingApproval) {
      const approvalMessage: ModelMessage = {
        role: "system",
        content: pendingApproval.approved
          ? `✅ User APPROVED: "${pendingApproval.permissionData.action}". You may now proceed with the action.`
          : `❌ User DENIED: "${pendingApproval.permissionData.action}". Do not proceed with this action. Suggest alternatives or ask what else you can help with.`,
      };
      conversationMessages.push(approvalMessage);
    }

    // Get interactive tools (including the permission tool)
    const interactiveTools = webToolsService.getToolsByKeys([
      "interactiveAskPermission",
      "executeCommand",
    ]);

    console.log(
      "🔧 [Interactive API] Using tools:",
      interactiveTools.map((t) => t.description?.substring(0, 50) + "...")
    );

    try {
      // Use streamText with tools for interactive mode
      const result = await aiService.streamText(
        conversationMessages,
        interactiveTools,
        MAX_STEPS
      );

      // Convert stream to text
      let fullResponse = "";
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      console.log(
        "✅ [Interactive API] Got response:",
        fullResponse.substring(0, 100) + "..."
      );

      // Normal response
      return Response.json({
        content: fullResponse,
        requiresPermission: false,
      });
    } catch (toolError: any) {
      console.log("🔍 [Interactive API] Caught error:", toolError.message);

      // Check if this is a permission request
      if (toolError.isPermissionRequest && toolError.permissionData) {
        console.log(
          "🛡️ [Interactive API] Permission requested!",
          toolError.permissionData
        );

        return Response.json({
          requiresPermission: true,
          permissionData: toolError.permissionData,
          partialContent: "I need your permission to proceed...",
        });
      }

      // Re-throw other errors
      throw toolError;
    }
  } catch (error: any) {
    console.error("❌ Interactive AI API error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

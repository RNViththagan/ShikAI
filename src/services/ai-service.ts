import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, streamText } from "ai";
import { getConfig } from "../config/app-config";

/**
 * AI Service - Handles all AI model interactions
 */
export class AIService {
  private config = getConfig();

  /**
   * Generate text using the AI model
   */
  async generateText(prompt: string, maxTokens: number = 50): Promise<string> {
    try {
      const { text } = await generateText({
        model: anthropic(this.config.agent.defaultModel),
        prompt,
        maxOutputTokens: maxTokens,
      });
      return text;
    } catch (error) {
      console.error("Error generating text:", error);
      throw error;
    }
  }

  /**
   * Stream text using the AI model with tools
   */
  async streamText(messages: any[], tools: any, maxSteps: number) {
    return await streamText({
      model: anthropic(this.config.agent.defaultModel),
      messages,
      tools,
      stopWhen: stepCountIs(maxSteps),
    });
  }

  /**
   * Generate a chat summary for conversation titles
   */
  async generateChatSummary(
    messages: any[],
    isFirstMessage: boolean = false,
    currentTitle: string = ""
  ): Promise<string> {
    try {
      // Get recent user messages for context (last 10 messages or so)
      const recentMessages = messages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .slice(-10);

      if (recentMessages.length === 0) {
        return "New Chat";
      }

      // Create a summarization prompt
      const conversationText = recentMessages
        .map((msg) => {
          if (msg.role === "user") {
            return `User: ${msg.content}`;
          } else if (msg.role === "assistant") {
            // Handle different content formats
            let content = "";
            if (Array.isArray(msg.content)) {
              content = msg.content
                .map((part: any) =>
                  part.type === "text" ? part.text : `[${part.type}]`
                )
                .join("");
            } else {
              content = msg.content as string;
            }
            return `Assistant: ${content}`;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");

      let promptText: string;

      if (isFirstMessage) {
        promptText = `Please generate a very brief, descriptive title (3-6 words) for this conversation based on what the user is asking about or wants to accomplish. Focus on the main topic, task, or question. Be specific and actionable. Do not include quotes, colons, or extra formatting - just the title words:

${conversationText}

Generate a concise title:`;
      } else if (currentTitle) {
        promptText = `Current conversation title: "${currentTitle}"

Based on the recent conversation below, generate an updated brief title (3-6 words) that captures the current focus. If the topic hasn't significantly changed, keep it similar to the current title. If there's a new main focus, update accordingly. No quotes or formatting - just the title words:

${conversationText}

Updated title:`;
      } else {
        promptText = `Generate a brief, descriptive title (3-6 words) for this conversation based on the main topics being discussed. Focus on the core subject or task. No quotes or formatting - just the title words:

${conversationText}

Title:`;
      }

      const text = await this.generateText(promptText, 50);

      // Clean up the title - remove quotes, extra spaces, and format properly
      const cleanTitle = text
        .replace(/['"]/g, "") // Remove quotes
        .replace(/^(Title|Updated title|Generate a concise title):\s*/i, "") // Remove prompt prefixes
        .replace(/[^\w\s\-]/g, "") // Remove special characters except hyphens
        .trim()
        .split(/\s+/) // Split into words
        .slice(0, 6) // Take first 6 words max
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ) // Title case
        .join(" ")
        .substring(0, 50); // Max 50 characters

      return cleanTitle || "New Chat Session";
    } catch (error) {
      console.error("Error generating chat summary:", error);
      return "Chat Session";
    }
  }
}

import * as fs from "fs";
import * as path from "path";
import { CoreMessage } from "ai";
import { extractTitleFromFileName, updateConversationFile } from "./file-utils";

/**
 * Conversation management utilities
 */

// Interface for conversation metadata
export interface ConversationMetadata {
  id: string;
  timestamp: string;
  lastMessage: string;
  messageCount: number;
  fileName?: string;
  lastModified?: Date;
}

/**
 * Validate and ensure conversation ID is in proper timestamp format
 */
export function ensureProperConversationId(
  id: string,
  fallbackTimestamp: string
): string {
  // Check if it's already in proper timestamp format: YYYY-MM-DDTHH-mm-ss-sssZ
  const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

  if (timestampPattern.test(id)) {
    return id;
  }

  // If it's not in proper format, use the fallback timestamp
  console.log(
    `⚠️  Conversation ID "${id}" is not in proper timestamp format, using fallback.`
  );
  return fallbackTimestamp;
}

/**
 * List available conversations
 */
export function listConversations(logDir: string): ConversationMetadata[] {
  const files = fs
    .readdirSync(logDir)
    .filter(
      (file) => file.startsWith("conversation-") && file.endsWith(".json")
    )
    .map((file) => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      return {
        fileName: file,
        lastModified: stats.mtime,
      };
    })
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()) // Sort by last modified time (newest first)
    .map((fileInfo) => fileInfo.fileName);

  return files
    .slice(0, 10)
    .map((file, index) => {
      try {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const lastUserMessage = [...content]
          .reverse()
          .find((msg: any) => msg.role === "user");

        // Try to extract title from filename first, fallback to last message
        const titleFromFileName = extractTitleFromFileName(file);
        const displayMessage = titleFromFileName
          ? titleFromFileName
          : lastUserMessage?.content?.substring(0, 60) || "No messages";

        return {
          id: (index + 1).toString(),
          timestamp: file
            .replace("conversation-", "")
            .replace(".json", "")
            .replace(/-/g, ":")
            .replace(/T/, " "),
          lastMessage: displayMessage,
          messageCount: content.filter(
            (msg: any) => msg.role === "user" || msg.role === "assistant"
          ).length,
          fileName: file,
          lastModified: stats.mtime,
        };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean) as ConversationMetadata[];
}

/**
 * Load a conversation from file
 */
export function loadConversation(
  logDir: string,
  fileName: string
): CoreMessage[] {
  try {
    const content = JSON.parse(
      fs.readFileSync(path.join(logDir, fileName), "utf8")
    );
    return content as CoreMessage[];
  } catch (error) {
    console.error("Error loading conversation:", error);
    return [];
  }
}

/**
 * Save conversation to file
 */
export function saveConversation(
  filePath: string,
  messages: CoreMessage[]
): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error("Error saving conversation:", error);
  }
}

/**
 * Generate and apply initial title for new conversations
 */
export async function generateInitialTitle(
  aiService: any,
  clientMessages: CoreMessage[],
  userInput: string,
  logDir: string,
  currentFilePath: string,
  conversationId: string
): Promise<{ title: string; updatedFilePath: string }> {
  if (userInput === "continue" || userInput.trim() === "") {
    return { title: "", updatedFilePath: currentFilePath };
  }

  console.log("\n✨ Let me create a title for our conversation...");
  try {
    const currentChatTitle = await aiService.generateChatSummary(
      clientMessages,
      true
    );
    console.log(`🎯 Our conversation topic: "${currentChatTitle}"`);

    // Update filename with the new title
    const updatedFilePath = updateConversationFile(
      logDir,
      currentFilePath,
      conversationId,
      currentChatTitle
    );

    // Only log if the file was successfully renamed
    if (updatedFilePath !== currentFilePath) {
      console.log(
        `📄 Conversation saved as: ${path.basename(updatedFilePath)}`
      );
    }

    return { title: currentChatTitle, updatedFilePath };
  } catch (error) {
    console.error("⚠️  Couldn't create a title:", error);
    console.log("💡 Don't worry, I'll continue without a custom title!");
    return { title: "", updatedFilePath: currentFilePath };
  }
}

/**
 * Update conversation title periodically
 */
export async function updateConversationTitle(
  aiService: any,
  clientMessages: CoreMessage[],
  currentTitle: string,
  logDir: string,
  currentFilePath: string,
  conversationId: string
): Promise<{ title: string; updatedFilePath: string }> {
  console.log("\n🔄 Updating our conversation title...");
  try {
    const newTitle = await aiService.generateChatSummary(
      clientMessages,
      false,
      currentTitle
    );

    if (newTitle !== currentTitle && newTitle.trim() !== "") {
      console.log(`📝 Title updated: "${currentTitle}" → "${newTitle}"`);

      // Update filename with the new title
      const updatedFilePath = updateConversationFile(
        logDir,
        currentFilePath,
        conversationId,
        newTitle
      );

      if (updatedFilePath !== currentFilePath) {
        console.log(`📄 File renamed to: ${path.basename(updatedFilePath)}`);
      }

      return { title: newTitle, updatedFilePath };
    } else {
      console.log(`✓ Title remains: "${currentTitle}"`);
      return { title: currentTitle, updatedFilePath: currentFilePath };
    }
  } catch (error) {
    console.error("⚠️  Couldn't update the title:", error);
    console.log("💡 Continuing with current title...");
    return { title: currentTitle, updatedFilePath: currentFilePath };
  }
}

/**
 * Check if title should be updated based on message count and interval
 */
export function shouldUpdateTitle(
  messageCount: number,
  titleInterval: number,
  isFirstUserInput: boolean,
  currentChatTitle: string
): boolean {
  return (
    messageCount > 0 &&
    messageCount % titleInterval === 0 &&
    !isFirstUserInput &&
    !!currentChatTitle
  );
}

/**
 * Append final messages to conversation history with cache control management
 */
export function appendFinalMessages(
  history: any[],
  finalMessages: any[],
  knownIds: Set<string>,
  cache: boolean = true
): void {
  // First, remove cache control from previous assistant messages (except system message)
  if (cache) {
    history.forEach((msg) => {
      if (
        msg.role === "assistant" &&
        msg.providerOptions?.anthropic?.cacheControl
      ) {
        delete msg.providerOptions.anthropic.cacheControl;
        // Clean up empty providerOptions
        if (Object.keys(msg.providerOptions.anthropic).length === 0) {
          delete msg.providerOptions.anthropic;
        }
        if (Object.keys(msg.providerOptions).length === 0) {
          delete msg.providerOptions;
        }
      }
    });
  }

  // Then add new messages
  for (let i = 0; i < finalMessages.length; i++) {
    const m = finalMessages[i];

    if ((m.role === "assistant" || m.role === "tool") && m.id) {
      if (!knownIds.has(m.id)) {
        knownIds.add(m.id);

        // Only add cache control to the final assistant message
        if (cache && i === finalMessages.length - 1 && m.role === "assistant") {
          m.providerOptions = {
            anthropic: { cacheControl: { type: "ephemeral" } },
          };
        }

        history.push(m);
      }
    }
  }
}

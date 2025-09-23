import * as fs from "fs";
import * as path from "path";
import { CoreMessage } from "ai";
import { extractTitleFromFileName } from "./file-utils";

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

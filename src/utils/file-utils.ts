import * as fs from "fs";
import * as path from "path";

/**
 * File utilities for conversation management
 */

/**
 * Generate filename with chat title
 */
export function getConversationFileName(
  logDir: string,
  conversationId: string,
  chatTitle: string
): string {
  if (chatTitle && chatTitle !== "") {
    // Clean the title for filesystem compatibility
    const cleanTitle = chatTitle
      .replace(/[^a-zA-Z0-9\s\-_]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase();
    return `${logDir}/conversation-${conversationId}-${cleanTitle}.json`;
  }
  return `${logDir}/conversation-${conversationId}.json`;
}

/**
 * Extract chat title from filename
 */
export function extractTitleFromFileName(fileName: string): string | null {
  // Match pattern: conversation-timestamp-title.json where timestamp is YYYY-MM-DDTHH-mm-ss-sssZ
  const match = fileName.match(
    /^conversation-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-(.+)\.json$/
  );
  if (match && match[2]) {
    // Convert underscores back to spaces and title case
    return match[2]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return null;
}

/**
 * Update filename when title changes
 */
export function updateConversationFile(
  logDir: string,
  oldFilePath: string,
  conversationId: string,
  newTitle: string
): string {
  try {
    const newFilePath = getConversationFileName(
      logDir,
      conversationId,
      newTitle
    );

    if (oldFilePath !== newFilePath && fs.existsSync(oldFilePath)) {
      // Check if new file already exists to avoid overwriting
      if (!fs.existsSync(newFilePath)) {
        fs.renameSync(oldFilePath, newFilePath);
        console.log(`📝 Updated filename to reflect current topic`);
        return newFilePath;
      }
    }
  } catch (error) {
    console.error("Could not update filename:", error);
  }
  return oldFilePath;
}

/**
 * Fix malformed conversation filenames
 */
export function fixMalformedFilename(
  logDir: string,
  malformedFileName: string,
  properConversationId: string,
  title: string = ""
): string {
  try {
    const oldFilePath = path.join(logDir, malformedFileName);
    const newFilePath = getConversationFileName(
      logDir,
      properConversationId,
      title
    );

    if (oldFilePath !== newFilePath && fs.existsSync(oldFilePath)) {
      if (!fs.existsSync(newFilePath)) {
        fs.renameSync(oldFilePath, newFilePath);
        console.log(
          `🔧 Fixed malformed filename: ${malformedFileName} → ${path.basename(
            newFilePath
          )}`
        );
        return newFilePath;
      }
    }
  } catch (error) {
    console.error("Could not fix malformed filename:", error);
  }
  return path.join(logDir, malformedFileName);
}

/**
 * Ensure directory exists
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

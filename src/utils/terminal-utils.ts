import * as readline from "readline";
import { ConversationMetadata } from "./conversation-utils";

/**
 * Terminal and user input utilities
 */

/**
 * Create question prompt for user input
 */
export function askQuestion(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    rl.question("You: ", (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Create continue question prompt
 */
export function askContinueQuestion(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    // Temporarily disable the prompt and handle input directly
    const originalPrompt = rl.getPrompt();
    rl.setPrompt("");

    const handleLine = (input: string) => {
      rl.removeListener("line", handleLine);
      rl.setPrompt(originalPrompt);
      resolve(input.trim());
    };

    rl.on("line", handleLine);
  });
}

/**
 * Display conversation selection interface
 */
export function displayConversationSelection(
  conversations: ConversationMetadata[]
): void {
  if (conversations.length === 0) {
    console.log(
      "🌟 This looks like our first time chatting! I'm excited to meet you!\n"
    );
    return;
  }

  console.log(
    "🔍 Here are our previous conversations - which one would you like to continue?"
  );
  console.log("─".repeat(80));
  console.log(
    "ID | Last Chat           | Topic / Last Message               | Messages"
  );
  console.log("─".repeat(80));

  conversations.forEach((conv) => {
    const lastModifiedStr = conv.lastModified
      ? conv.lastModified
          .toLocaleString("en-US", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(",", "")
      : conv.timestamp;

    console.log(
      `${conv.id.padStart(2)} | ${lastModifiedStr.padEnd(
        19
      )} | ${conv.lastMessage.padEnd(35)} | ${conv.messageCount}`
    );
  });

  console.log("─".repeat(80));
  console.log(
    "✨ Choose a conversation number (1-10) to continue, or press Enter to start fresh:"
  );
}

/**
 * Handle conversation selection
 */
export function selectConversation(
  rl: readline.Interface,
  conversations: ConversationMetadata[]
): Promise<string | null> {
  displayConversationSelection(conversations);

  return new Promise((resolve) => {
    rl.question("Your choice: ", (answer) => {
      const choice = answer.trim();
      if (!choice) {
        resolve(null);
      } else {
        const selectedConv = conversations.find((c) => c.id === choice);
        if (selectedConv) {
          resolve((selectedConv as any).fileName);
        } else {
          console.log(
            "🤔 Hmm, that doesn't look right. Let's start fresh instead!\n"
          );
          resolve(null);
        }
      }
    });
  });
}

/**
 * Display conversation context (last few messages)
 */
export function displayConversationContext(
  messages: any[],
  agentName: string,
  currentChatTitle?: string
): void {
  console.log(`\n🎉 Great! I'm back to continue our conversation!`);
  console.log(`💬 I've loaded our ${messages.length} previous messages`);
  if (currentChatTitle) {
    console.log(`💭 We were talking about: "${currentChatTitle}"`);
  }

  // Show last few messages for context
  const lastMessages = messages
    .slice(-4)
    .filter((msg) => msg.role === "user" || msg.role === "assistant");

  if (lastMessages.length > 0) {
    console.log("\n📋 Let me remind you where we left off:");
    console.log("─".repeat(50));
    lastMessages.forEach((msg) => {
      if (msg.role === "user") {
        console.log(`You: ${msg.content}`);
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
        console.log(
          `${agentName}: ${content.substring(0, 100)}${
            content.length > 100 ? "..." : ""
          }`
        );
      }
    });
    console.log("─".repeat(50));
  }

  console.log("\nType 'exit' to quit\n");
}

/**
 * Handle max steps continuation workflow
 * Returns true if should continue, false if should stop
 */
export async function handleMaxStepsContinuation(
  rl: any,
  maxSteps: number
): Promise<{ shouldContinue: boolean; skipNextQuestion: boolean }> {
  // Show the prompt on the same line
  process.stdout.write(
    `\n⚠️  Reached maximum steps (${maxSteps}). Continue? (y/n): `
  );

  try {
    const continueAnswer = await askContinueQuestion(rl);

    // Clear the line and move cursor back to overwrite the prompt
    process.stdout.write("\r\x1b[K"); // \r moves to start of line, \x1b[K clears to end of line

    if (
      continueAnswer.toLowerCase() === "y" ||
      continueAnswer.toLowerCase() === "yes"
    ) {
      console.log(`⚠️  Reached maximum steps (${maxSteps}). Continuing...`);
      return { shouldContinue: true, skipNextQuestion: true };
    } else {
      console.log(`⚠️  Reached maximum steps (${maxSteps}). Stopped by user.`);
      return { shouldContinue: false, skipNextQuestion: false };
    }
  } catch (error) {
    console.error("\n❌ Error getting user input:", error);
    console.log("\n⏹️  Stopping due to input error.");
    return { shouldContinue: false, skipNextQuestion: false };
  }
}

/**
 * Handle special commands like save, history, etc.
 * Returns true if command was handled and should continue to next iteration
 */
export function handleSpecialCommands(
  userInput: string,
  currentFilePath: string,
  clientMessages: any[],
  conversationId: string,
  isResumedConversation: boolean,
  currentChatTitle?: string
): boolean {
  const command = userInput.toLowerCase();

  if (command === "save") {
    const fs = require("fs");
    const path = require("path");
    fs.writeFileSync(currentFilePath, JSON.stringify(clientMessages, null, 2));
    console.log(`💾 Conversation saved to ${path.basename(currentFilePath)}`);
    return true; // Command handled, continue to next iteration
  }

  if (command === "history") {
    console.log(`📊 Current conversation: ${clientMessages.length} messages`);
    console.log(`🆔 Conversation ID: ${conversationId}`);
    console.log(`🔄 Resumed: ${isResumedConversation ? "Yes" : "No"}`);
    if (currentChatTitle) {
      console.log(`💭 Current title: "${currentChatTitle}"`);
    }
    return true; // Command handled, continue to next iteration
  }

  return false; // No special command handled, proceed normally
}

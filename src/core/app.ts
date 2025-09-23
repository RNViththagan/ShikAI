import "dotenv/config";
import { CoreMessage } from "ai";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import {
  getAgentName,
  getMaxSteps,
  getTitleUpdateInterval,
} from "../config/app-config";
import { AIService, ToolsService } from "../services";
import {
  getConversationFileName,
  extractTitleFromFileName,
  ensureProperConversationId,
  updateConversationFile,
  fixMalformedFilename,
  ensureDirectoryExists,
  listConversations,
  loadConversation,
  saveConversation,
  ConversationMetadata,
  askQuestion,
  askContinueQuestion,
  selectConversation,
  displayConversationContext,
} from "../utils";

// Get configuration values
const MAX_STEPS = getMaxSteps();
const AGENT_NAME = getAgentName();

const main = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = "conversation-logs";
  const titleInterval = getTitleUpdateInterval();

  // Initialize services
  const aiService = new AIService();
  const toolsService = new ToolsService();

  // Ensure logs directory exists
  ensureDirectoryExists(logDir);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let clientMessages: Array<CoreMessage> = [];
  let conversationId: string = "";
  let isResumedConversation = false;
  let currentChatTitle = "";
  let messageCount = 0; // Count total messages (user + assistant)
  let isFirstUserInput = true; // Track if this is the very first user input
  let currentFilePath = ""; // Track current file path for title updates

  // Get tools from service
  const tools = toolsService.getAllTools(rl);

  // Initialize conversation
  console.log(
    `✨ Hi there! I'm ${AGENT_NAME}, your personal assistant! Ready to help you with anything! 💫\n`
  );

  // Check if user wants to resume a conversation
  const conversations = listConversations(logDir);
  const selectedConversation = await selectConversation(rl, conversations);

  if (selectedConversation) {
    // Load existing conversation
    clientMessages = loadConversation(logDir, selectedConversation);

    // Extract conversation ID properly (handle files with titles)
    let extractedId = selectedConversation
      .replace("conversation-", "")
      .replace(".json", "");

    // If there's a title, get only the timestamp part
    // Match pattern: YYYY-MM-DDTHH-mm-ss-sssZ (timestamp format)
    const timestampMatch = extractedId.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/
    );
    let candidateId = timestampMatch ? timestampMatch[1] : extractedId;

    // Ensure the conversation ID is in proper timestamp format
    conversationId = ensureProperConversationId(candidateId, timestamp);

    // If the conversation ID was invalid/malformed, fix the filename
    if (candidateId !== conversationId) {
      currentFilePath = fixMalformedFilename(
        logDir,
        selectedConversation,
        conversationId,
        currentChatTitle
      );
    } else {
      currentFilePath = path.join(logDir, selectedConversation);
    }

    isResumedConversation = true;

    // Extract chat title from filename if available
    currentChatTitle = extractTitleFromFileName(selectedConversation) || "";

    // If no title exists and we have messages, generate one
    if (!currentChatTitle && clientMessages.length > 1) {
      console.log(
        "\n🎯 This conversation doesn't have a title yet. Let me create one..."
      );
      try {
        currentChatTitle = await aiService.generateChatSummary(clientMessages);
        console.log(`✨ Generated title: "${currentChatTitle}"`);

        // Update the filename with the new title
        currentFilePath = updateConversationFile(
          logDir,
          currentFilePath,
          conversationId,
          currentChatTitle
        );
      } catch (error) {
        console.error("Could not generate title:", error);
        currentChatTitle = "";
      }
    }

    // If currentFilePath wasn't set above, set it now
    if (!currentFilePath) {
      currentFilePath = getConversationFileName(
        logDir,
        conversationId,
        currentChatTitle
      );
    }

    // Initialize message count for resumed conversations
    messageCount = clientMessages.filter(
      (msg) => msg.role === "user" || msg.role === "assistant"
    ).length;

    console.log(`\n🎉 Great! I'm back to continue our conversation!`);
    console.log(
      `💬 I've loaded our ${clientMessages.length} previous messages`
    );
    if (currentChatTitle) {
      console.log(`💭 We were talking about: "${currentChatTitle}"`);
    }

    // Display conversation context
    displayConversationContext(clientMessages, AGENT_NAME, currentChatTitle);
  } else {
    // Start new conversation
    conversationId = timestamp;
    currentFilePath = getConversationFileName(logDir, conversationId, "");
    clientMessages.push({
      role: "system",
      content: `Hi! I'm ${AGENT_NAME}, your friendly personal assistant with full computer access! 😊

WHO I AM:
- Your dedicated personal assistant who's always here to help
- I'm friendly, patient, and genuinely care about making your life easier
- I have full access to your computer's terminal and can help with any task
- Think of me as your tech-savvy friend who never gets tired of helping!

WHAT I CAN DO FOR YOU:
- 💻 Handle any computer tasks - coding, file management, system operations
- 🛠️ Solve problems step-by-step, explaining everything clearly
- 📝 Write, edit, and organize your files and projects
- 🔍 Research, analyze data, and find information
- ⚡ Automate repetitive tasks to save you time
- 🎯 Help you learn new skills while we work together

MY APPROACH:
- I'll always ask clarifying questions if I'm unsure about what you need
- I explain things in simple terms, but can go technical if you want
- I'm proactive - I'll suggest improvements and alternatives
- I remember our conversations and build on what we've discussed
- I'll warn you about risky operations and suggest safer approaches
- I celebrate your successes and help you learn from challenges

🚨 PERMISSION REQUIREMENTS - VERY IMPORTANT:
- ALWAYS use the askPermission tool before executing major commands that could:
  • Delete, move, or modify important files/directories
  • Install or uninstall software (apt, npm, pip, etc.)
  • Change system settings or configurations
  • Execute commands with sudo/admin privileges
  • Make network requests or downloads
  • Modify Git repositories (commits, pushes, merges, etc.)
  • Run potentially destructive or irreversible operations
  • Write to system directories or configuration files
- For simple/safe commands (ls, pwd, cat, echo, grep, find, etc.), proceed normally
- When in doubt, always ask first - it's better to be safe!
- Explain clearly what you want to do and why it's needed

PERSONALITY:
- Warm, friendly, and encouraging
- Patient and understanding - no question is too basic
- Enthusiastic about helping you achieve your goals
- Honest when I don't know something
- Supportive and positive, even when things get tricky

I'm here to make your computing experience smoother and more enjoyable. Whether you need help with a simple task or a complex project, just let me know what you'd like to accomplish! ✨`,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });

    console.log(
      "🌟 Perfect! Let's start a fresh conversation! What would you like to work on today?\n"
    );
  }

  const knownIds = new Set<string>();
  const appendFinalMessages = (
    history: Array<CoreMessage>,
    finalMessages: Array<CoreMessage>,
    cache: boolean
  ) => {
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

      if ((m.role === "assistant" || m.role === "tool") && (m as any).id) {
        if (!knownIds.has((m as any).id)) {
          knownIds.add((m as any).id);

          // Only add cache control to the final assistant message
          if (
            cache &&
            i === finalMessages.length - 1 &&
            m.role === "assistant"
          ) {
            m.providerOptions = {
              anthropic: { cacheControl: { type: "ephemeral" } },
            };
          }

          history.push(m as CoreMessage);
        }
      }
    }
  };

  let userInput: string;
  let skipNextQuestion = false;

  // Set initial values based on whether this is a resumed conversation
  isFirstUserInput = !isResumedConversation;

  try {
    while (true) {
      if (skipNextQuestion) {
        userInput = "continue";
        skipNextQuestion = false;
      } else {
        userInput = await askQuestion(rl);
      }

      const startTime = Date.now();
      if (userInput.toLowerCase() === "exit") {
        console.log(
          `${AGENT_NAME}: Take care! I really enjoyed helping you today. Feel free to come back anytime! ✨`
        );
        break;
      }

      // Handle special commands
      if (userInput.toLowerCase() === "save") {
        fs.writeFileSync(
          currentFilePath,
          JSON.stringify(clientMessages, null, 2)
        );
        console.log(
          `💾 Conversation saved to ${path.basename(currentFilePath)}`
        );
        continue;
      }

      if (userInput.toLowerCase() === "history") {
        console.log(
          `📊 Current conversation: ${clientMessages.length} messages`
        );
        console.log(`🆔 Conversation ID: ${conversationId}`);
        console.log(`🔄 Resumed: ${isResumedConversation ? "Yes" : "No"}`);
        if (currentChatTitle) {
          console.log(`💭 Current title: "${currentChatTitle}"`);
        }
        continue;
      }

      // Add user message to conversation
      clientMessages.push({ role: "user", content: userInput });
      messageCount++;

      // Generate title based on first user input for new conversations
      if (
        isFirstUserInput &&
        userInput !== "continue" &&
        userInput.trim() !== ""
      ) {
        console.log("\n✨ Let me create a title for our conversation...");
        try {
          currentChatTitle = await aiService.generateChatSummary(
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

          // Only update currentFilePath if the file was successfully renamed
          if (updatedFilePath !== currentFilePath) {
            currentFilePath = updatedFilePath;
            console.log(
              `📄 Conversation saved as: ${path.basename(currentFilePath)}`
            );
          }

          isFirstUserInput = false;
        } catch (error) {
          console.error("⚠️  Couldn't create a title:", error);
          console.log("💡 Don't worry, I'll continue without a custom title!");
          isFirstUserInput = false;
        }
      }

      // Update title every N total messages (user + assistant messages)
      if (
        messageCount > 0 &&
        messageCount % titleInterval === 0 &&
        !isFirstUserInput &&
        currentChatTitle
      ) {
        console.log("\n🔄 Updating our conversation title...");
        try {
          const newTitle = await aiService.generateChatSummary(
            clientMessages,
            false,
            currentChatTitle
          );
          if (newTitle !== currentChatTitle && newTitle.trim() !== "") {
            console.log(
              `📝 Title updated: "${currentChatTitle}" → "${newTitle}"`
            );

            // Update filename with the new title
            const updatedFilePath = updateConversationFile(
              logDir,
              currentFilePath,
              conversationId,
              newTitle
            );

            if (updatedFilePath !== currentFilePath) {
              currentFilePath = updatedFilePath;
              console.log(
                `📄 File renamed to: ${path.basename(currentFilePath)}`
              );
            }

            currentChatTitle = newTitle;
          } else {
            console.log(`✓ Title remains: "${currentChatTitle}"`);
          }
        } catch (error) {
          console.error("⚠️  Couldn't update the title:", error);
          console.log("💡 Continuing with current title...");
        }
      }

      console.log(`\n${AGENT_NAME}: `);

      const {
        textStream,
        fullStream,
        usage,
        providerMetadata,
        response,
        steps,
      } = await aiService.streamText(clientMessages, tools, MAX_STEPS);

      for await (const part of fullStream) {
        process.stdout.write(part.type === "text-delta" ? part.textDelta : "");
      }

      const { messages: finalMessages } = await response;
      const step = await steps;
      const tokenDetails = await providerMetadata;

      const cache = true;
      appendFinalMessages(clientMessages, finalMessages, cache);

      // Count assistant messages added (typically 1, but could be more with tool calls)
      const assistantMessagesAdded = finalMessages.filter(
        (msg: any) => msg.role === "assistant"
      ).length;
      messageCount += assistantMessagesAdded;

      // Check if we should update title after assistant response
      if (
        messageCount > 0 &&
        messageCount % titleInterval === 0 &&
        !isFirstUserInput &&
        currentChatTitle
      ) {
        console.log(
          "\n🔄 Updating our conversation title after recent exchanges..."
        );
        try {
          const newTitle = await aiService.generateChatSummary(
            clientMessages,
            false,
            currentChatTitle
          );
          if (newTitle !== currentChatTitle) {
            console.log(`📝 Title updated to: "${newTitle}"`);

            // Update filename with the new title
            currentFilePath = updateConversationFile(
              logDir,
              currentFilePath,
              conversationId,
              newTitle
            );
            currentChatTitle = newTitle;
          } else {
            console.log(`✓ Title remains: "${currentChatTitle}"`);
          }
        } catch (error) {
          console.error("Oops, couldn't update the title:", error);
        }
      }

      // Auto-save conversation after each exchange
      fs.writeFileSync(
        currentFilePath,
        JSON.stringify(clientMessages, null, 2)
      );

      // Check if we need to ask user to continue (based on step results)
      const stepResults = await steps;
      const hasMaxSteps = stepResults && stepResults.length >= MAX_STEPS;

      if (hasMaxSteps) {
        // Show the prompt on the same line
        process.stdout.write(
          `\n⚠️  Reached maximum steps (${MAX_STEPS}). Continue? (y/n): `
        );

        try {
          const continueAnswer = await askContinueQuestion(rl);

          // Clear the line and move cursor back to overwrite the prompt
          process.stdout.write("\r\x1b[K"); // \r moves to start of line, \x1b[K clears to end of line

          if (
            continueAnswer.toLowerCase() === "y" ||
            continueAnswer.toLowerCase() === "yes"
          ) {
            console.log(
              `⚠️  Reached maximum steps (${MAX_STEPS}). Continuing...`
            );
            // Set flag to skip asking question in next iteration
            skipNextQuestion = true;
            continue;
          } else {
            console.log(
              `⚠️  Reached maximum steps (${MAX_STEPS}). Stopped by user.`
            );
            break; // Exit the while loop when user chooses to stop
          }
        } catch (error) {
          console.error("\n❌ Error getting user input:", error);
          console.log("\n⏹️  Stopping due to input error.");
          break;
        }
      }

      console.log("\n📊 Response Details:");
      console.log("- Cache token details:", tokenDetails);
      console.log("- Token usage:", await usage);
      console.log("- Response time:", Date.now() - startTime, "ms");
      console.log("\n");
    }
  } catch (error) {
    console.error("Error with Claude:", error);
    console.log("Make sure to set ANTHROPIC_API_KEY in your .env file");
  } finally {
    rl.close();

    // Final save
    fs.writeFileSync(currentFilePath, JSON.stringify(clientMessages, null, 2));
    console.log(
      `💾 Final conversation saved to ${path.basename(currentFilePath)}`
    );

    // Clean up created files
    try {
      if (fs.existsSync("x1.txt")) {
        fs.unlinkSync("x1.txt");
        console.log("Cleaned up x1.txt file");
      }
    } catch (error) {
      console.error("Error cleaning up files:", error);
    }
  }
};

export { main };

// Start the application if run directly
if (require.main === module) {
  main().catch(console.error);
}

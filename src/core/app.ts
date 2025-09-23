import "dotenv/config";
import { CoreMessage } from "ai";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import {
  getAgentName,
  getMaxSteps,
  getTitleUpdateInterval,
  getPromptTemplate,
} from "../config/app-config";
import { getPromptTemplate as getPromptTemplateContent } from "../config/prompts";
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
  generateInitialTitle,
  updateConversationTitle,
  shouldUpdateTitle,
  appendFinalMessages,
  askQuestion,
  askContinueQuestion,
  selectConversation,
  displayConversationContext,
  handleMaxStepsContinuation,
  handleSpecialCommands,
} from "../utils";

// Get configuration values
const MAX_STEPS = getMaxSteps();
const AGENT_NAME = getAgentName();
const PROMPT_TEMPLATE_NAME = getPromptTemplate();

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
      content: getPromptTemplateContent(PROMPT_TEMPLATE_NAME, AGENT_NAME),
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });

    console.log(
      "🌟 Perfect! Let's start a fresh conversation! What would you like to work on today?\n"
    );
  }

  const knownIds = new Set<string>();

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
      if (
        handleSpecialCommands(
          userInput,
          currentFilePath,
          clientMessages,
          conversationId,
          isResumedConversation,
          currentChatTitle
        )
      ) {
        continue; // Command was handled, skip to next iteration
      }

      // Add user message to conversation
      clientMessages.push({ role: "user", content: userInput });
      messageCount++;

      // Generate title based on first user input for new conversations
      if (isFirstUserInput) {
        const titleResult = await generateInitialTitle(
          aiService,
          clientMessages,
          userInput,
          logDir,
          currentFilePath,
          conversationId
        );

        currentChatTitle = titleResult.title;
        currentFilePath = titleResult.updatedFilePath;
        isFirstUserInput = false;
      }

      // Update title every N total messages (user + assistant messages)
      if (
        shouldUpdateTitle(
          messageCount,
          titleInterval,
          isFirstUserInput,
          currentChatTitle
        )
      ) {
        const titleResult = await updateConversationTitle(
          aiService,
          clientMessages,
          currentChatTitle,
          logDir,
          currentFilePath,
          conversationId
        );

        currentChatTitle = titleResult.title;
        currentFilePath = titleResult.updatedFilePath;
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
      appendFinalMessages(clientMessages, finalMessages, knownIds, cache);

      // Count assistant messages added (typically 1, but could be more with tool calls)
      const assistantMessagesAdded = finalMessages.filter(
        (msg: any) => msg.role === "assistant"
      ).length;
      messageCount += assistantMessagesAdded;

      // Check if we should update title after assistant response
      if (
        shouldUpdateTitle(
          messageCount,
          titleInterval,
          isFirstUserInput,
          currentChatTitle
        )
      ) {
        const titleResult = await updateConversationTitle(
          aiService,
          clientMessages,
          currentChatTitle,
          logDir,
          currentFilePath,
          conversationId
        );

        currentChatTitle = titleResult.title;
        currentFilePath = titleResult.updatedFilePath;
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
        const continuationResult = await handleMaxStepsContinuation(
          rl,
          MAX_STEPS
        );

        if (continuationResult.shouldContinue) {
          skipNextQuestion = continuationResult.skipNextQuestion;
          continue;
        } else {
          break; // Exit the while loop when user chooses to stop
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
  }
};

export { main };

// Start the application if run directly
if (require.main === module) {
  main().catch(console.error);
}

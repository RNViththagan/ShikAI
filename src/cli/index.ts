#!/usr/bin/env node

/**
 * AI Assistant CLI Entry Point
 *
 * Command-line interface for the AI Assistant with Conversation Management
 */

import { program } from "commander";
import { version } from "../../package.json";
import { getAgentName } from "../config/app-config";

const agentName = getAgentName();

program
  .name("shikai")
  .description(
    `${agentName} - Intelligent Terminal Assistant with Conversation Management`
  )
  .version(version);

program
  .command("chat")
  .description("Start a new chat session or resume existing conversation")
  .option("-r, --resume", "Resume last conversation")
  .option("-c, --conversation <id>", "Resume specific conversation by ID")
  .action(async (options) => {
    console.log(`Starting ${agentName} chat...`);
    // Import and start main application
    const { main } = await import("../core/app");
    await main();
  });

program
  .command("list")
  .alias("ls")
  .description("List all saved conversations")
  .action(() => {
    console.log("📋 Conversation list feature coming soon!");
  });

program
  .command("config")
  .description(`Configure ${agentName} settings`)
  .option("--set-api-key <key>", "Set Anthropic API key")
  .action((options) => {
    console.log("⚙️ Configuration feature coming soon!");
  });

// Default command - start chat
program.action(async () => {
  console.log(`🚀 Starting ${agentName}...`);
  const { main } = await import("../core/app");
  await main();
});

program.parse();

#!/usr/bin/env node

/**
 * ShikAI CLI Entry Point
 * 
 * Command-line interface for ShikAI - Intelligent Terminal Assistant
 */

import { program } from 'commander';
import { version } from '../../package.json';

program
  .name('shikai')
  .description('ShikAI - Intelligent Terminal Assistant with Conversation Management')
  .version(version);

program
  .command('chat')
  .description('Start a new chat session or resume existing conversation')
  .option('-r, --resume', 'Resume last conversation')
  .option('-c, --conversation <id>', 'Resume specific conversation by ID')
  .action(async (options) => {
    console.log('Starting ShikAI chat...');
    // Import and start main application
    const { main } = await import('../core/shikai');
    await main();
  });

program
  .command('list')
  .alias('ls')
  .description('List all saved conversations')
  .action(() => {
    console.log('📋 Conversation list feature coming soon!');
  });

program
  .command('config')
  .description('Configure ShikAI settings')
  .option('--set-api-key <key>', 'Set Anthropic API key')
  .action((options) => {
    console.log('⚙️ Configuration feature coming soon!');
  });

// Default command - start chat
program
  .action(async () => {
    console.log('🚀 Starting ShikAI...');
    const { main } = await import('../core/shikai');
    await main();
  });

program.parse();

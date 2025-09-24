# ShikAI Web Interface

A Next.js web interface for ShikAI that reuses all the existing CLI utilities and services.

## 🚀 Current Status

✅ **Real AI Integration** - Uses same AIService as CLI version!
✅ **New Chat Functionality** - Create conversations with one click
✅ **Enhanced UI** - Conversation titles, better messaging interface
✅ **Error Handling** - Graceful fallbacks and user feedback
✅ **Same Configuration** - Shares .env, prompts, and settings with CLI

## 🏗️ Architecture

```
web/
├── app/
│   ├── api/chat/route.ts      # API endpoint (will use existing services)
│   ├── page.tsx               # Main chat interface
│   └── layout.tsx             # App layout
├── package.json               # Web dependencies
└── next.config.js             # Module resolution for @shared imports
```

## 🔧 Development

```bash
# From the web directory
cd web
npm install
npm run dev
```

The web interface runs on `http://localhost:3001`

## 📋 Features

### ✅ Completed (Phase 2)

- **Real AI Integration** - Now uses actual AIService from CLI
- **New Chat Functionality** - Create new conversations with one click
- **Enhanced UI** - Better chat interface with conversation titles
- **Error Handling** - Graceful fallbacks when AI service is unavailable
- **Same Configuration** - Shares .env and config with CLI version

### 🔄 Next Steps (Phase 3)

- Add conversation persistence using existing `conversation-utils`
- Conversation list sidebar (reusing `listConversations`)
- Integrate safe tools for web interface (non-file system tools)

### 🎯 Future Features (Phase 4+)

- File upload/download capabilities
- Real-time command execution with progress
- Same prompt templates as CLI (coding-focused, data-analysis, etc.)
- Conversation history search

## 🔗 Shared Code Usage

The web interface is designed to import and reuse existing CLI utilities:

```typescript
// Reusing existing services
import { AIService } from "@shared/services/ai-service";
import { ToolsService } from "@shared/services/tools-service";

// Reusing configuration
import { getAgentName, getMaxSteps } from "@shared/config/app-config";
import { getPromptTemplate } from "@shared/config/prompts";

// Reusing conversation utilities
import {
  listConversations,
  generateInitialTitle,
  appendFinalMessages,
} from "@shared/utils/conversation-utils";
```

This ensures the web interface has **exactly the same capabilities** as the CLI version!

## 🎯 Goal

Create a **single app** that offers both CLI and web interfaces with shared:

- AI capabilities
- Configuration
- Conversation management
- Tools and command execution
- Prompt templates

The web interface is the same ShikAI, just with a different front-end! 🌐

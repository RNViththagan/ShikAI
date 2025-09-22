# 🚀 ShikAI - Intelligent Terminal Assistant

> An AI-powered terminal assistant with persistent conversations and safe command execution

ShikAI combines the power of Anthropic's Claude with intelligent conversation management, allowing you to have ongoing discussions with AI while safely executing terminal commands with human approval.

## ✨ Key Features

- 🧠 **Intelligent Conversations** - Powered by Claude 4 Sonnet
- 💾 **Persistent History** - Never lose conversation context
- 🔒 **Safe Execution** - Human-in-the-loop approval for commands  
- 🏷️ **Smart Titles** - Auto-generated conversation titles
- 📁 **File Management** - Organized conversation storage
- 🔄 **Resume Capability** - Continue conversations from where you left off
- 🎯 **Multi-Step Reasoning** - AI can execute complex multi-step tasks
- ⚡ **Real-time Streaming** - See AI responses as they're generated

## 🛠️ Installation

### Prerequisites
- Node.js >= 18.0.0
- Anthropic API key

### Quick Install
```bash
# Clone the repository
git clone https://github.com/RNViththagan/ShikAI.git
cd ShikAI

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Build the project
npm run build

# Start using ShikAI
npm start
```

### Global Installation (Coming Soon)
```bash
npm install -g shikai
shikai
```

## 🚀 Usage

### Basic Usage
```bash
# Start a new conversation
npm start

# Or use the CLI directly
npm run cli
```

### CLI Commands (Coming Soon)
```bash
# Start a chat session
shikai chat

# Resume last conversation
shikai chat --resume

# Resume specific conversation
shikai chat --conversation 5

# List all conversations
shikai list

# Configure settings
shikai config --set-api-key your-key
```

## 📋 Features in Detail

### 🤖 AI-Powered Conversations
- Natural language interaction with Claude 4 Sonnet
- Context-aware responses that remember conversation history
- Intelligent reasoning and problem-solving capabilities

### 🔐 Safe Command Execution
- Human approval required for all system commands
- Clear display of commands before execution
- Risk assessment and explanation for each command

### 💾 Conversation Management
- Automatic saving of conversation history
- Smart title generation based on conversation content
- Resume conversations from any point
- Organized file storage with timestamps

### 🎯 Multi-Step Task Execution
- AI can break down complex tasks into steps
- Execute multiple commands in sequence
- Handle errors gracefully and suggest alternatives

## 📁 Project Structure

```
ShikAI/
├── src/
│   ├── core/           # Core AI functionality
│   │   ├── shikai.ts   # Main application logic
│   │   └── data/       # Static data files
│   ├── cli/            # Command-line interface
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript type definitions
│   └── config/         # Configuration management
├── bin/                # Executable scripts
├── docs/               # Documentation
├── examples/           # Usage examples
└── dist/               # Compiled JavaScript (generated)
```

## ⚙️ Configuration

### Environment Variables
```env
# Required
ANTHROPIC_API_KEY=your-api-key-here

# Optional
AGENT_NAME=ShikAI
MAX_CONVERSATION_HISTORY=100
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Vercel AI SDK](https://sdk.vercel.ai/)
- Powered by [Anthropic's Claude](https://www.anthropic.com/)
- Inspired by the need for intelligent terminal assistance

## 🔗 Links

- [GitHub Repository](https://github.com/RNViththagan/ShikAI)
- [Issue Tracker](https://github.com/RNViththagan/ShikAI/issues)
- [Discussions](https://github.com/RNViththagan/ShikAI/discussions)

---

**ShikAI** - Making terminal interactions more intelligent, one conversation at a time. 🤖✨

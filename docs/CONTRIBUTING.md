# Contributing to ShikAI

Thank you for your interest in contributing to ShikAI! We welcome contributions from the community.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RNViththagan/ShikAI.git
   cd ShikAI
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   # Add your API keys to .env
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

## Project Structure

```
ShikAI/
├── src/
│   ├── core/           # Core AI functionality
│   │   ├── shikai.ts   # Main application logic
│   │   └── data/       # Data files
│   └── cli/            # CLI interface
│       └── index.ts    # CLI entry point
├── bin/                # Executable scripts
├── docs/               # Documentation
├── examples/           # Usage examples
└── dist/               # Built output
```

## Development Workflow

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write clean, documented code
   - Follow TypeScript best practices
   - Add tests for new functionality

3. **Test your changes:**
   ```bash
   npm run build
   npm test
   ```

4. **Submit a pull request:**
   - Provide a clear description of changes
   - Link any relevant issues
   - Ensure CI passes

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Add JSDoc comments for public functions
- Use meaningful variable and function names

## Areas for Contribution

- 🐛 Bug fixes and improvements
- ✨ New AI tools and capabilities
- 📚 Documentation improvements
- 🧪 Test coverage expansion
- 🎨 UI/UX enhancements
- 🌐 Internationalization

## Questions?

Feel free to open an issue for questions or reach out to the maintainers!

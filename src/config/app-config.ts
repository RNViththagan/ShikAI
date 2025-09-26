/**
 * Application Configuration
 *
 * Centralized configuration management for the AI assistant
 */

export interface AppConfig {
  agent: {
    name: string;
    defaultModel: string;
    maxSteps: number;
  };
  conversation: {
    autoSave: boolean;
    titleUpdateInterval: number;
  };
  ui: {
    emoji: boolean;
    colors: boolean;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AppConfig = {
  agent: {
    name: "Assistant", // Default name, overridden by environment variable
    defaultModel: "claude-4-sonnet-20250514",
    maxSteps: 5,
  },
  conversation: {
    autoSave: true,
    titleUpdateInterval: 5, // Update title every N messages
  },
  ui: {
    emoji: true,
    colors: true,
  },
};

/**
 * Get current application configuration
 */
export function getConfig(): AppConfig {
  // Read environment variables at runtime for dynamic configuration
  return {
    ...DEFAULT_CONFIG,
    agent: {
      ...DEFAULT_CONFIG.agent,
      name: process.env.AGENT_NAME || DEFAULT_CONFIG.agent.name,
      maxSteps: process.env.MAX_STEPS
        ? parseInt(process.env.MAX_STEPS, 10) || DEFAULT_CONFIG.agent.maxSteps
        : DEFAULT_CONFIG.agent.maxSteps,
    },
  };
}

/**
 * Get agent name from configuration
 */
export function getAgentName(): string {
  return getConfig().agent.name;
}

/**
 * Get max steps from configuration
 */
export function getMaxSteps(): number {
  return getConfig().agent.maxSteps;
}

/**
 * Get title update interval from configuration
 */
export function getTitleUpdateInterval(): number {
  return getConfig().conversation.titleUpdateInterval;
}

/**
 * Get the prompt template name from environment or use default
 */
export function getPromptTemplate(): string {
  return "default";
}

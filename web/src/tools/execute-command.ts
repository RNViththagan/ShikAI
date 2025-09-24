import { tool } from "ai";
import { z } from "zod";

/**
 * Web-safe execute command tool
 * This tool explains what commands would be executed but doesn't actually run them
 * for security reasons in a web environment
 */
export const executeCommandTool = tool({
  description:
    "Explain what terminal commands would be executed to accomplish a task. For security, commands are not actually executed in the web environment.",
  inputSchema: z.object({
    command: z.string().describe("The terminal command that would be executed"),
    purpose: z.string().describe("What this command accomplishes"),
    workingDirectory: z
      .string()
      .optional()
      .describe("The directory where this command should be run"),
    safetyNotes: z
      .string()
      .optional()
      .describe("Any safety considerations or prerequisites"),
  }),
  execute: async ({ command, purpose, workingDirectory, safetyNotes }) => {
    // Log the tool call
    console.log("🛠️ [executeCommandTool] Called with:", {
      command,
      purpose,
      workingDirectory,
      safetyNotes,
      timestamp: new Date().toISOString()
    });

    // In web environment, we explain instead of executing
    const result = {
      type: "command_explanation",
      data: {
        command,
        purpose,
        workingDirectory: workingDirectory || "current directory",
        safetyNotes,
        timestamp: new Date().toISOString(),
      },
      message: `To ${purpose}, you would run: \`${command}\`${
        workingDirectory ? ` in ${workingDirectory}` : ""
      }${safetyNotes ? `\n\n⚠️ Safety note: ${safetyNotes}` : ""}`,
      executed: false,
      reason: "Commands are not executed in web environment for security",
    };

    console.log("✅ [executeCommandTool] Returning result:", result);
    return result;
  },
});

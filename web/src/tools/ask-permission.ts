import { tool } from "ai";
import { z } from "zod";

/**
 * Web-compatible permission tool
 * This tool explains what permission would be needed and why,
 * but doesn't actually require interactive approval in streaming mode
 */
export const askPermissionTool = tool({
  description:
    "Explain what permission would be needed for potentially risky actions. This provides transparency about what the AI would do and why, but doesn't block execution in web environment.",
  inputSchema: z.object({
    action: z
      .string()
      .describe("Description of the action you want to perform"),
    command: z
      .string()
      .optional()
      .describe("The specific command(s) you want to execute (if applicable)"),
    risks: z.string().describe("Potential risks or impacts of this action"),
    reason: z.string().describe("Why this action is needed to help the user"),
    severity: z
      .enum(["low", "medium", "high"])
      .default("medium")
      .describe("Risk severity level"),
  }),
  execute: async ({ action, command, risks, reason, severity }) => {
    // Log the tool call
    console.log("🛠️ [askPermissionTool] Called with:", {
      action,
      command,
      risks,
      reason,
      severity,
      timestamp: new Date().toISOString(),
    });

    // In web environment, we explain the permission that would be needed
    const severityEmoji =
      severity === "high" ? "🚨" : severity === "medium" ? "⚠️" : "ℹ️";

    const result = {
      type: "permission_explanation",
      message: `${severityEmoji} **Permission Notice**: I would normally ask for permission to ${action}.

**What I want to do**: ${action}
${command ? `**Command**: \`${command}\`` : ""}
**Why**: ${reason}
**Risks**: ${risks}
**Severity**: ${severity.toUpperCase()}

In a CLI environment, I would pause here and ask for your explicit approval before proceeding. In this web interface, I'm explaining what I would do for transparency.`,
      severity,
      action,
      command,
      risks,
      reason,
      webSafe: true,
    };

    console.log("✅ [askPermissionTool] Returning result:", result);
    return result;
  },
});

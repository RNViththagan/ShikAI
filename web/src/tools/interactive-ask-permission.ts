import { tool } from "ai";
import { z } from "zod";

/**
 * Interactive permission tool that actually triggers frontend permission dialogs
 * This tool throws a special error that the API can catch to pause execution
 */
export const interactiveAskPermissionTool = tool({
  description:
    "Request explicit permission from the user before executing potentially risky actions. This will pause the conversation and show a permission dialog.",
  parameters: z.object({
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
    console.log("🛡️ [interactiveAskPermissionTool] PERMISSION REQUESTED:", {
      action,
      command,
      risks,
      reason,
      severity,
      timestamp: new Date().toISOString()
    });

    // Throw a special permission error that the API can catch
    const permissionError = new Error("PERMISSION_REQUIRED");
    (permissionError as any).permissionData = {
      action,
      command,
      risks,
      reason,
      severity,
      timestamp: new Date().toISOString(),
    };
    (permissionError as any).isPermissionRequest = true;

    throw permissionError;
  },
});

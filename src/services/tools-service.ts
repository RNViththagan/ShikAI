import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { getAgentName } from "../config/app-config";

/**
 * Tools Service - Contains all the AI tools/functions
 */
export class ToolsService {
  private execAsync = promisify(exec);
  private agentName = getAgentName();

  /**
   * Create the permission tool for human-in-the-loop approval
   */
  createPermissionTool(rl: any) {
    return tool({
      description:
        "Ask the user for explicit permission before executing major/potentially risky commands. Use this for any operation that could delete files, install software, change system settings, etc.",
      inputSchema: z.object({
        action: z
          .string()
          .describe("Description of the action you want to perform"),
        command: z
          .string()
          .describe("The specific command(s) you want to execute"),
        risks: z.string().describe("Potential risks or impacts of this action"),
        reason: z
          .string()
          .describe("Why this action is needed to help the user"),
      }),
      execute: async ({ action, command, risks, reason }) => {
        console.log(`\n🤔 ${this.agentName}: I'd like to ${action}`);
        console.log(`📋 Command: ${command}`);
        console.log(`⚠️  Potential risks: ${risks}`);
        console.log(`💡 Why I need this: ${reason}`);
        console.log(`\n🔄 May I proceed? (y/n):`);

        return new Promise((resolve) => {
          // Use the main readline interface instead of creating a new one
          rl.question("Your choice: ", (answer: string) => {
            const approved =
              answer.toLowerCase().trim() === "y" ||
              answer.toLowerCase().trim() === "yes";

            if (approved) {
              console.log(
                `✅ ${this.agentName}: Thank you! I'll proceed with the action.`
              );
              resolve({
                approved: true,
                message: "User granted permission to proceed",
              });
            } else {
              console.log(
                `❌ ${this.agentName}: Understood! I won't execute that command. What would you like to do instead?`
              );
              resolve({
                approved: false,
                message: "User denied permission. Action cancelled.",
              });
            }
          });
        });
      },
    });
  }

  /**
   * Create the command execution tool
   */
  createExecuteCommandTool() {
    return tool({
      description:
        "Execute terminal commands as if opening a terminal and running them directly. Use this for any command-line operations.",
      inputSchema: z.object({
        command: z.string().describe("The terminal command to execute"),
      }),
      execute: async ({ command }) => {
        try {
          console.log(`\n$ ${command}`);

          const { stdout, stderr } = await this.execAsync(command, {
            timeout: 60000,
            maxBuffer: 5 * 1024 * 1024,
            cwd: process.cwd(),
          });

          return {
            success: true,
            output: stdout || stderr || "Command completed",
            exitCode: 0,
          };
        } catch (error: any) {
          console.error(`Command failed with exit code ${error.code || 1}`);
          if (error.stdout) {
            console.log(error.stdout);
          }
          if (error.stderr) {
            console.error(error.stderr);
          }

          return {
            success: false,
            output: error.stdout || error.stderr || error.message,
            exitCode: error.code || 1,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Get all tools for the AI
   */
  getAllTools(rl: any) {
    return {
      askPermission: this.createPermissionTool(rl),
      executeCommand: this.createExecuteCommandTool(),
    };
  }
}

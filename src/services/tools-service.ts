import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { existsSync, statSync } from "fs";
import { glob } from "glob";
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
   * Create the read file tool
   */
  createReadFileTool() {
    return tool({
      description:
        "Reads a file from the local filesystem. You can access any file directly by using this tool. " +
        "Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. " +
        "It is okay to read a file that does not exist; an error will be returned.\n\n" +
        "Usage:\n" +
        "- The file_path parameter must be an absolute path, not a relative path\n" +
        "- By default, it reads up to 2000 lines starting from the beginning of the file\n" +
        "- You can optionally specify a line offset and limit (especially handy for long files)\n" +
        "- Any lines longer than 2000 characters will be truncated\n" +
        "- Results are returned using cat -n format, with line numbers starting at 1\n" +
        "- This tool can read text files, configuration files, source code, logs, etc.\n" +
        "- This tool can only read files, not directories. To read a directory, use the executeCommand tool with ls\n" +
        "- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.",
      inputSchema: z.object({
        file_path: z.string().describe("The absolute path to the file to read"),
        offset: z
          .number()
          .optional()
          .describe(
            "The line number to start reading from. Only provide if the file is too large to read at once"
          ),
        limit: z
          .number()
          .optional()
          .describe(
            "The number of lines to read. Only provide if the file is too large to read at once."
          ),
      }),
      execute: async ({ file_path, offset = 0, limit = 2000 }) => {
        try {
          // Check if file exists
          if (!existsSync(file_path)) {
            return {
              success: false,
              error: `File not found: ${file_path}`,
              content: "",
            };
          }

          // Read the file content
          const content = await readFile(file_path, "utf-8");

          if (content.length === 0) {
            return {
              success: true,
              warning: "File exists but has empty contents",
              content: "",
              lines_read: 0,
            };
          }

          // Split into lines
          const lines = content.split("\n");

          // Apply offset and limit
          const startLine = Math.max(0, offset);
          const endLine = Math.min(lines.length, startLine + limit);
          const selectedLines = lines.slice(startLine, endLine);

          // Format with line numbers (cat -n style)
          const numberedContent = selectedLines
            .map((line, index) => {
              const lineNumber = startLine + index + 1;
              // Truncate long lines to 2000 characters
              const truncatedLine =
                line.length > 2000 ? line.substring(0, 2000) + "..." : line;
              return `${lineNumber.toString().padStart(6)}  ${truncatedLine}`;
            })
            .join("\n");

          return {
            success: true,
            content: numberedContent,
            lines_read: selectedLines.length,
            total_lines: lines.length,
            file_path,
            offset_used: startLine,
            limit_used: limit,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Failed to read file: ${error.message}`,
            content: "",
            file_path,
          };
        }
      },
    });
  }

  /**
   * Create the glob file search tool
   */
  createGlobTool() {
    return tool({
      description:
        "- Fast file pattern matching tool that works with any codebase size\n" +
        '- Supports glob patterns like "**/*.js" or "src/**/*.ts"\n' +
        "- Returns matching file paths sorted by modification time\n" +
        "- Use this tool when you need to find files by name patterns\n" +
        "- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead\n" +
        "- You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.",
      inputSchema: z.object({
        pattern: z.string().describe("The glob pattern to match files against"),
        path: z
          .string()
          .optional()
          .describe(
            'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.'
          ),
      }),
      execute: async ({ pattern, path }) => {
        try {
          console.log(
            `\n🔍 Searching for pattern: ${pattern}${path ? ` in ${path}` : ""}`
          );

          // Set the search directory - use provided path or current working directory
          const searchDir = path || process.cwd();

          // Validate search directory exists
          if (path && !existsSync(path)) {
            return {
              success: false,
              error: `Directory not found: ${path}`,
              pattern,
              path: path,
              matches: [],
            };
          }

          // Construct the full pattern with directory
          const fullPattern = path ? `${path}/${pattern}` : pattern;

          // Use glob to find matching files
          const matches = await glob(fullPattern, {
            dot: false, // Don't include hidden files by default
            follow: false, // Don't follow symlinks
            ignore: [
              "**/node_modules/**",
              "**/dist/**",
              "**/build/**",
              "**/.git/**",
              "**/*.log",
            ],
          });

          // Get file stats and sort by modification time (newest first)
          const filesWithStats = await Promise.all(
            matches.map(async (file) => {
              try {
                const stats = statSync(file);
                return {
                  path: file,
                  mtime: stats.mtime,
                  size: stats.size,
                  isFile: stats.isFile(),
                  isDirectory: stats.isDirectory(),
                };
              } catch (error) {
                // If we can't get stats, still include the file
                return {
                  path: file,
                  mtime: new Date(0),
                  size: 0,
                  isFile: true,
                  isDirectory: false,
                };
              }
            })
          );

          // Filter out directories (only return files) and sort by modification time
          const sortedFiles = filesWithStats
            .filter((f) => f.isFile)
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
            .map((f) => f.path);

          return {
            success: true,
            pattern,
            search_directory: searchDir,
            matches: sortedFiles,
            match_count: sortedFiles.length,
            sorted_by: "modification_time_desc",
          };
        } catch (error: any) {
          console.error(`Glob search failed: ${error.message}`);
          return {
            success: false,
            error: `Glob search failed: ${error.message}`,
            pattern,
            path: path || process.cwd(),
            matches: [],
          };
        }
      },
    });
  }

  /**
   * Create the grep search tool
   */
  createGrepTool() {
    return tool({
      description:
        "A powerful search tool built on ripgrep\n\n" +
        "Usage:\n" +
        "- ALWAYS use Grep for search tasks. NEVER invoke `grep` or `rg` as a Bash command. The Grep tool has been optimized for correct permissions and access.\n" +
        "- Try to specify the search path to avoid ambiguity. If not specified, the current working directory will be used.\n" +
        '- Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")\n' +
        '- Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")\n' +
        '- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts\n' +
        "- Use Task tool for open-ended searches requiring multiple rounds\n" +
        "- Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use `interface\\{\\}` to find `interface{}` in Go code)\n" +
        "- Multiline matching: By default patterns match within single lines only. For cross-line patterns like `struct \\{[\\s\\S]*?field`, use `multiline: true`",
      inputSchema: z.object({
        pattern: z
          .string()
          .describe(
            "The regular expression pattern to search for in file contents"
          ),
        path: z
          .string()
          .optional()
          .describe(
            "File or directory to search in (rg PATH). Defaults to current working directory."
          ),
        output_mode: z
          .enum(["content", "files_with_matches", "count"])
          .optional()
          .describe(
            'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".'
          ),
        glob: z
          .string()
          .optional()
          .describe(
            'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob'
          ),
        type: z
          .string()
          .optional()
          .describe(
            "File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types."
          ),
        "-i": z
          .boolean()
          .optional()
          .describe("Case insensitive search (rg -i)"),
        "-n": z
          .boolean()
          .optional()
          .describe(
            'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise.'
          ),
        "-A": z
          .number()
          .optional()
          .describe(
            'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.'
          ),
        "-B": z
          .number()
          .optional()
          .describe(
            'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.'
          ),
        "-C": z
          .number()
          .optional()
          .describe(
            'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.'
          ),
        multiline: z
          .boolean()
          .optional()
          .describe(
            "Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false."
          ),
        head_limit: z
          .number()
          .optional()
          .describe(
            'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). When unspecified, shows all results from ripgrep.'
          ),
      }),
      execute: async ({
        pattern,
        path,
        output_mode = "files_with_matches",
        glob: globPattern,
        type,
        "-i": caseInsensitive,
        "-n": showLineNumbers,
        "-A": afterContext,
        "-B": beforeContext,
        "-C": aroundContext,
        multiline,
        head_limit,
      }) => {
        try {
          console.log(`\n🔍 Searching for pattern: ${pattern}`);

          // Build ripgrep command args
          const rgArgs: string[] = [];

          // Add pattern (properly escaped)
          rgArgs.push(JSON.stringify(pattern));

          // Add output mode flags
          if (output_mode === "files_with_matches") {
            rgArgs.push("-l"); // --files-with-matches
          } else if (output_mode === "count") {
            rgArgs.push("-c"); // --count
          }
          // For "content" mode, no special flag needed (default behavior)

          // Add case insensitive flag
          if (caseInsensitive) {
            rgArgs.push("-i");
          }

          // Add line numbers (only for content mode)
          if (showLineNumbers && output_mode === "content") {
            rgArgs.push("-n");
          }

          // Add context options (only for content mode)
          if (output_mode === "content") {
            if (aroundContext !== undefined) {
              rgArgs.push("-C", aroundContext.toString());
            } else {
              if (beforeContext !== undefined) {
                rgArgs.push("-B", beforeContext.toString());
              }
              if (afterContext !== undefined) {
                rgArgs.push("-A", afterContext.toString());
              }
            }
          }

          // Add multiline support
          if (multiline) {
            rgArgs.push("-U", "--multiline-dotall");
          }

          // Add glob pattern
          if (globPattern) {
            rgArgs.push("--glob", globPattern);
          }

          // Add file type
          if (type) {
            rgArgs.push("--type", type);
          }

          // Add common useful flags
          rgArgs.push("--color=never"); // Disable color for cleaner output
          rgArgs.push("--no-heading"); // Don't group matches by file

          // Build the full command
          let command = `rg ${rgArgs.join(" ")}`;

          // Add path if specified (after all options)
          if (path) {
            command += ` ${JSON.stringify(path)}`;
          } else {
            command += ` ${JSON.stringify(process.cwd())}`;
          }

          // Add head limit if specified
          if (head_limit) {
            command += ` | head -${head_limit}`;
          }

          console.log(`🚀 Executing: ${command}`);

          const { stdout, stderr } = await this.execAsync(command, {
            timeout: 30000,
            //maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            //cwd: process.cwd(), // Always use current working directory for cwd
          });
          const output = stdout || stderr || "";
          const lines = output
            .trim()
            .split("\n")
            .filter((line) => line.length > 0);

          return {
            success: true,
            pattern,
            output_mode,
            search_path: path || process.cwd(),
            results: lines,
            match_count: lines.length,
            command_executed: command,
            filters_applied: {
              glob: globPattern,
              type,
              case_insensitive: caseInsensitive,
              multiline,
              head_limit,
            },
          };
        } catch (error: any) {
          // ripgrep returns exit code 1 when no matches found, which is normal
          if (error.code === 1 && error.stdout === "") {
            return {
              success: true,
              pattern,
              output_mode,
              search_path: path || process.cwd(),
              results: [],
              match_count: 0,
              message: "No matches found",
              command_executed: `rg ${pattern}${path ? ` ${path}` : ""}`,
            };
          }

          console.error(`Grep search failed: ${error.message}`);
          return {
            success: false,
            error: `Grep search failed: ${error.message}`,
            pattern,
            output_mode,
            search_path: path || process.cwd(),
            results: [],
            stderr: error.stderr || "",
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
      readFile: this.createReadFileTool(),
      glob: this.createGlobTool(),
      grep: this.createGrepTool(),
    };
  }
}

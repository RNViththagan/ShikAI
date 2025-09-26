import { askPermissionTool } from "./ask-permission";
import { executeCommandTool } from "./execute-command";

/**
 * Web Tools Service - Manages web-safe AI tools
 * These tools are designed for web environments and don't perform
 * potentially dangerous operations like the CLI versions
 */
export class WebToolsService {
  /**
   * Get all web-safe tools for the AI
   */
  getAllTools() {
    console.log("🛠️ [WebToolsService] getAllTools() called");
    const tools = {
      askPermission: askPermissionTool,
      executeCommand: executeCommandTool,
    };
    console.log("📦 [WebToolsService] Available tools:", Object.keys(tools));
    return tools;
  }

  /**
   * Get tools as an array (useful for AI SDK)
   */
  getToolsArray() {
    console.log("🛠️ [WebToolsService] getToolsArray() called");
    const tools = this.getAllTools();
    const toolsArray = Object.values(tools);
    console.log(
      "📊 [WebToolsService] Returning",
      toolsArray.length,
      "tools as array"
    );
    return toolsArray;
  }

  /**
   * Get specific tools by keys
   */
  getToolsByKeys(keys: string[]) {
    console.log("🛠️ [WebToolsService] getToolsByKeys() called with:", keys);
    const allTools = this.getAllTools();
    const availableKeys = keys.filter((key) => key in allTools);
    const unavailableKeys = keys.filter((key) => !(key in allTools));

    if (unavailableKeys.length > 0) {
      console.warn(
        "⚠️ [WebToolsService] Unavailable tools requested:",
        unavailableKeys
      );
    }

    console.log("✅ [WebToolsService] Returning tools:", availableKeys);
    return availableKeys.map((key) => (allTools as any)[key]);
  }
}

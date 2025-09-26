import { askPermissionTool } from "./ask-permission";
import { ToolsService } from "@shared/services/tools-service";

/**
 * Web Tools Service - Manages web-safe AI tools
 * Uses the main project's ToolsService for execute command functionality
 */
export class WebToolsService {
  private mainToolsService: ToolsService;

  constructor() {
    this.mainToolsService = new ToolsService();
  }

  /**
   * Get all web-safe tools for the AI
   */
  getAllTools() {
    console.log("🛠️ [WebToolsService] getAllTools() called");
    const tools = {
      askPermission: askPermissionTool,
      executeCommand: this.mainToolsService.createExecuteCommandTool(),
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

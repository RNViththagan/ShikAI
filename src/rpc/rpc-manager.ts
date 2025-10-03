import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcErrorCodes,
  RpcMethodDefinition,
  RpcMethodHandler,
  RpcContext,
  IRpcManager,
} from "./types";

/**
 * Core RPC Manager - Handles JSON RPC 2.0 requests
 */
export class RpcManager implements IRpcManager {
  private methods: Map<string, RpcMethodDefinition> = new Map();

  /**
   * Register a new RPC method
   */
  registerMethod<TParams = any, TResult = any>(
    method: RpcMethodDefinition<TParams, TResult>
  ): void {
    if (this.methods.has(method.name)) {
      throw new Error(`Method '${method.name}' is already registered`);
    }

    this.methods.set(method.name, method);
    console.log(`📝 RPC method registered: ${method.name}`);
  }

  /**
   * Get all registered method names
   */
  getRegisteredMethods(): string[] {
    return Array.from(this.methods.keys());
  }

  /**
   * Handle a JSON RPC request
   */
  async handleRequest(
    request: JsonRpcRequest,
    context?: RpcContext
  ): Promise<JsonRpcResponse> {
    // Validate JSON RPC format
    if (request.jsonrpc !== "2.0") {
      return this.createErrorResponse(
        request.id,
        JsonRpcErrorCodes.INVALID_REQUEST,
        "Invalid JSON RPC version"
      );
    }

    if (!request.method || typeof request.method !== "string") {
      return this.createErrorResponse(
        request.id,
        JsonRpcErrorCodes.INVALID_REQUEST,
        "Missing or invalid method"
      );
    }

    // Check if method exists
    const methodDef = this.methods.get(request.method);
    if (!methodDef) {
      return this.createErrorResponse(
        request.id,
        JsonRpcErrorCodes.METHOD_NOT_FOUND,
        `Method '${request.method}' not found`
      );
    }

    try {
      // Validate parameters if schema is provided
      if (methodDef.paramsSchema && request.params !== undefined) {
        try {
          request.params = methodDef.paramsSchema.parse(request.params);
        } catch (validationError: any) {
          return this.createErrorResponse(
            request.id,
            JsonRpcErrorCodes.INVALID_PARAMS,
            "Invalid parameters",
            validationError.message
          );
        }
      }

      // Execute the method
      const result = await methodDef.handler(request.params, context);

      // Return result (only for requests with id)
      if (request.id !== undefined) {
        return {
          jsonrpc: "2.0",
          result,
          id: request.id,
        };
      }

      // For notifications (no id), we don't return anything
      return {
        jsonrpc: "2.0",
        id: null,
      };
    } catch (error: any) {
      console.error(`🚨 RPC method '${request.method}' error:`, error);

      return this.createErrorResponse(
        request.id,
        JsonRpcErrorCodes.INTERNAL_ERROR,
        "Internal error",
        error.message
      );
    }
  }

  /**
   * Handle batch requests
   */
  async handleBatchRequest(
    requests: JsonRpcRequest[],
    context?: RpcContext
  ): Promise<JsonRpcResponse[]> {
    const responses = await Promise.all(
      requests.map((request) => this.handleRequest(request, context))
    );

    // Filter out responses for notifications
    return responses.filter((response) => response.id !== null);
  }

  /**
   * Create a standardized error response
   */
  private createErrorResponse(
    id: string | number | null | undefined,
    code: number,
    message: string,
    data?: any
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        ...(data && { data }),
      },
      id: id ?? null,
    };
  }

  /**
   * Get method information for introspection
   */
  getMethodInfo(methodName: string) {
    const method = this.methods.get(methodName);
    if (!method) {
      return null;
    }

    return {
      name: method.name,
      description: method.description || "No description available",
      hasSchema: !!method.paramsSchema,
    };
  }

  /**
   * Get all methods information
   */
  getAllMethodsInfo() {
    return Array.from(this.methods.keys()).map((name) =>
      this.getMethodInfo(name)
    );
  }
}

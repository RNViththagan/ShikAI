// Define the types locally since @shared is not available
interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number | null;
}

interface JsonRpcResponse<T = any> {
  jsonrpc: "2.0";
  result?: T;
  error?: JsonRpcError;
  id?: string | number | null;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 * JSON RPC Client for the web interface
 */
export class RpcClient {
  private endpoint: string;
  private requestId: number = 0;

  constructor(endpoint: string = "/api/chat-rpc") {
    this.endpoint = endpoint;
  }

  /**
   * Generate a unique request ID
   */
  private generateId(): number {
    return ++this.requestId;
  }

  /**
   * Make a JSON RPC call
   */
  async call<TParams = any, TResult = any>(
    method: string,
    params?: TParams
  ): Promise<TResult> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: this.generateId(),
    };

    console.log(`🔄 RPC Call: ${method}`, params);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rpcResponse: JsonRpcResponse<TResult> = await response.json();

      if (rpcResponse.error) {
        const error = new RpcError(
          rpcResponse.error.message,
          rpcResponse.error.code,
          rpcResponse.error.data
        );
        console.error(`❌ RPC Error: ${method}`, error);
        throw error;
      }

      console.log(`✅ RPC Success: ${method}`, rpcResponse.result);
      return rpcResponse.result!;
    } catch (error) {
      console.error(`🚨 RPC Network Error: ${method}`, error);
      throw error;
    }
  }

  /**
   * Send a notification (no response expected)
   */
  async notify<TParams = any>(method: string, params?: TParams): Promise<void> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      // No ID for notifications
    };

    console.log(`🔔 RPC Notify: ${method}`, params);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ RPC Notify Sent: ${method}`);
    } catch (error) {
      console.error(`🚨 RPC Notify Error: ${method}`, error);
      throw error;
    }
  }

  /**
   * Make batch RPC calls
   */
  async batch<TResult = any>(
    calls: Array<{ method: string; params?: any }>
  ): Promise<TResult[]> {
    const requests: JsonRpcRequest[] = calls.map((call) => ({
      jsonrpc: "2.0",
      method: call.method,
      params: call.params,
      id: this.generateId(),
    }));

    console.log(`📦 RPC Batch: ${calls.length} calls`);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requests),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rpcResponses: JsonRpcResponse<TResult>[] = await response.json();

      // Check for errors and return results
      const results: TResult[] = [];
      const errors: JsonRpcError[] = [];

      rpcResponses.forEach((rpcResponse, index) => {
        if (rpcResponse.error) {
          errors.push(rpcResponse.error);
        } else {
          results.push(rpcResponse.result!);
        }
      });

      if (errors.length > 0) {
        console.error(`❌ RPC Batch Errors:`, errors);
        throw new BatchRpcError("Batch request contained errors", errors);
      }

      console.log(`✅ RPC Batch Success: ${results.length} results`);
      return results;
    } catch (error) {
      console.error(`🚨 RPC Batch Network Error:`, error);
      throw error;
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    try {
      const response = await fetch(this.endpoint, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`🚨 RPC Server Info Error:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async ping(): Promise<{ status: string; timestamp: string }> {
    return this.call("system.ping");
  }

  /**
   * List all available methods
   */
  async listMethods(): Promise<{ methods: string[]; count: number }> {
    return this.call("system.listMethods");
  }

  /**
   * Get information about a specific method
   */
  async getMethodInfo(methodName: string): Promise<any> {
    return this.call("system.methodInfo", methodName);
  }
}

/**
 * Custom RPC Error class
 */
export class RpcError extends Error {
  public readonly code: number;
  public readonly data?: any;

  constructor(message: string, code: number, data?: any) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}

/**
 * Batch RPC Error class
 */
export class BatchRpcError extends Error {
  public readonly errors: JsonRpcError[];

  constructor(message: string, errors: JsonRpcError[]) {
    super(message);
    this.name = "BatchRpcError";
    this.errors = errors;
  }
}

// Export a default client instance
export const rpcClient = new RpcClient();

// Export types
export type { JsonRpcRequest, JsonRpcResponse, JsonRpcError };

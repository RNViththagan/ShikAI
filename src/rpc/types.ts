/**
 * JSON RPC 2.0 Types and Interfaces
 */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: "2.0";
  result?: T;
  error?: JsonRpcError;
  id?: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

// Standard JSON RPC error codes
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// Method handler interface
export interface RpcMethodHandler<TParams = any, TResult = any> {
  (params: TParams, context?: RpcContext): Promise<TResult> | TResult;
}

// RPC Context for method execution
export interface RpcContext {
  requestId?: string | number | null;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
  };
  metadata?: Record<string, any>;
}

// Method registration interface
export interface RpcMethodDefinition<TParams = any, TResult = any> {
  name: string;
  handler: RpcMethodHandler<TParams, TResult>;
  description?: string;
  paramsSchema?: any; // Zod schema for validation
}

// RPC Manager interface
export interface IRpcManager {
  registerMethod<TParams = any, TResult = any>(
    method: RpcMethodDefinition<TParams, TResult>
  ): void;
  handleRequest(
    request: JsonRpcRequest,
    context?: RpcContext
  ): Promise<JsonRpcResponse>;
  getRegisteredMethods(): string[];
}

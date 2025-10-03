"use client";

import React, { useState, useRef, useEffect } from "react";
import { rpcClient, RpcError } from "../rpc";

interface ToolCall {
  id: string;
  name: string;
  input?: any;
  output?: any;
  status: "pending" | "executing" | "completed" | "error";
}

interface ContentPart {
  type: "text" | "tool_call" | "tool_result";
  content: string;
  toolCall?: ToolCall;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  contentParts: ContentPart[]; // Ordered sequence of text and tool parts
  timestamp: Date;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTextSegment, setCurrentTextSegment] = useState(""); // Track current text segment
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Resizable debug panel states
  const [debugPanelWidth, setDebugPanelWidth] = useState(50); // Default 50%
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (
    role: "user" | "assistant" | "system",
    content: string
  ) => {
    const newMessage: Message = {
      id: `${role}-${Date.now()}`,
      role: role,
      content: content,
      contentParts: [{ type: "text", content: content }],
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const [isStreaming, setIsStreaming] = useState(false);
  const [debugEvents, setDebugEvents] = useState<any[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<
    Map<string, ToolCall>
  >(new Map());

  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    console.log("Resizer clicked!");
    setIsResizing(true);
    document.body.style.cursor = "ew-resize";
    e.preventDefault();
  };
  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((containerRect.right - e.clientX) / containerRect.width) * 100;

      // Constrain between 20% and 80%
      const constrainedWidth = Math.max(20, Math.min(80, newWidth));
      setDebugPanelWidth(constrainedWidth);
    },
    [isResizing]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "default";
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    addMessage("user", userMessage);
    setIsLoading(true);

    try {
      // 🎯 This is the key part: RPC call to generate text
      const response = await rpcClient.call("ai.generateText", {
        prompt: userMessage,
        maxTokens: 100,
      });

      // Display the AI response
      addMessage("assistant", response.text);

      // Show some info about the call for learning purposes
      addMessage(
        "system",
        `✅ RPC Call completed successfully!
📊 Model: ${response.model}
⏱️ Timestamp: ${response.timestamp}
📝 Max tokens: ${response.maxTokens}`
      );
    } catch (error) {
      console.error("RPC call failed:", error);
      if (error instanceof RpcError) {
        addMessage("system", `❌ RPC Error (${error.code}): ${error.message}`);
      } else {
        addMessage(
          "system",
          `❌ Network Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    addMessage("user", userMessage);
    setIsStreaming(true);
    setCurrentTextSegment(""); // Reset text segment for new streaming session
    setDebugEvents([]); // Clear previous debug events

    try {
      // Create an assistant message that will be updated with streamed content
      const assistantMessageId = Date.now().toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        contentParts: [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentToolCalls(new Map()); // Reset tool calls for new message

      // Make streaming RPC call
      const rpcRequest = {
        jsonrpc: "2.0",
        method: "ai.streamText",
        params: {
          messages: [{ role: "user", content: userMessage }],
          maxSteps: 5,
        },
        id: Date.now(),
      };

      const response = await fetch("/api/chat-rpc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rpcRequest),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedContent = "";

      console.log("🌊 Starting to stream response...");

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("🏁 Stream completed");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));
              console.log("📦 Received streaming event:", eventData);

              if (eventData.type === "ui-stream-chunk") {
                const uiChunk = eventData.data.params.uiChunk;
                console.log("📝 Received UI chunk:", uiChunk);

                // Parse the UI stream data (it's in format: data: {...})
                if (uiChunk.startsWith("data: ")) {
                  try {
                    const dataStr = uiChunk.slice(6).trim(); // Remove "data: " prefix
                    if (dataStr === "[DONE]") {
                      console.log("🏁 Stream finished");
                      return;
                    }

                    const streamPart = JSON.parse(dataStr);
                    console.log("🎯 Parsed stream part:", streamPart);

                    // Add to debug events
                    setDebugEvents((prev) => [
                      ...prev,
                      {
                        timestamp: new Date().toISOString(),
                        type: streamPart.type,
                        data: streamPart,
                      },
                    ]);

                    // Handle different types of stream parts
                    switch (streamPart.type) {
                      case "start":
                        console.log("🚀 Stream started");
                        break;

                      case "start-step":
                        console.log("📋 Step started");
                        break;

                      case "text-start":
                        console.log(
                          "📝 Text generation started for ID:",
                          streamPart.id
                        );
                        break;

                      case "text-delta":
                        const textDelta = streamPart.delta;
                        console.log("📝 Text delta:", textDelta);

                        // Update current text segment
                        setCurrentTextSegment((prev) => prev + textDelta);
                        streamedContent += textDelta;

                        // Update ONLY the assistant message contentParts, maintaining segment order
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId &&
                            msg.role === "assistant"
                              ? {
                                  ...msg,
                                  content: "", // Don't use accumulated content anymore
                                  contentParts: (() => {
                                    const parts = [...msg.contentParts];
                                    const lastPart = parts[parts.length - 1];

                                    if (lastPart && lastPart.type === "text") {
                                      // Update the current text segment (append delta to existing text)
                                      parts[parts.length - 1] = {
                                        ...lastPart,
                                        content: lastPart.content + textDelta,
                                      };
                                    } else {
                                      // Start new text segment after a tool call
                                      parts.push({
                                        type: "text",
                                        content: textDelta,
                                      });
                                    }

                                    return parts;
                                  })(),
                                }
                              : msg
                          )
                        );
                        break;

                      case "text-end":
                        console.log(
                          "✅ Text generation ended for ID:",
                          streamPart.id
                        );
                        break;

                      case "tool-input-start":
                        console.log(
                          "🔧 Tool input started:",
                          streamPart.toolName,
                          streamPart.toolCallId
                        );
                        const newToolCall: ToolCall = {
                          id: streamPart.toolCallId,
                          name: streamPart.toolName,
                          status: "pending",
                        };
                        setCurrentToolCalls(
                          (prev) =>
                            new Map(
                              prev.set(streamPart.toolCallId, newToolCall)
                            )
                        );

                        // Reset current text segment since tool call interrupts text flow
                        setCurrentTextSegment("");

                        // Add tool call inline to contentParts at current position
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId &&
                            msg.role === "assistant"
                              ? {
                                  ...msg,
                                  contentParts: [
                                    ...msg.contentParts,
                                    {
                                      type: "tool_call",
                                      content: "",
                                      toolCall: newToolCall,
                                    },
                                  ],
                                }
                              : msg
                          )
                        );
                        break;

                      case "tool-input-delta":
                        console.log(
                          "🔧 Tool input delta:",
                          streamPart.inputTextDelta
                        );
                        // Just log for now, input is built up progressively
                        break;

                      case "tool-input-available":
                        console.log(
                          "🔧 Tool input available:",
                          streamPart.input
                        );
                        setCurrentToolCalls((prev) => {
                          const updated = new Map(prev);
                          const tool = updated.get(streamPart.toolCallId);
                          if (tool) {
                            const updatedTool = {
                              ...tool,
                              input: streamPart.input,
                              status: "executing" as const,
                            };
                            updated.set(streamPart.toolCallId, updatedTool);

                            // Also update in contentParts
                            setMessages((prevMsgs) =>
                              prevMsgs.map((msg) =>
                                msg.id === assistantMessageId &&
                                msg.role === "assistant"
                                  ? {
                                      ...msg,
                                      contentParts: msg.contentParts.map(
                                        (part) =>
                                          part.type === "tool_call" &&
                                          part.toolCall?.id ===
                                            streamPart.toolCallId
                                            ? { ...part, toolCall: updatedTool }
                                            : part
                                      ),
                                    }
                                  : msg
                              )
                            );
                          }
                          return updated;
                        });
                        break;

                      case "tool-output-available":
                        console.log("🔧 Tool output:", streamPart.output);
                        setCurrentToolCalls((prev) => {
                          const updated = new Map(prev);
                          const tool = updated.get(streamPart.toolCallId);
                          if (tool) {
                            const updatedTool: ToolCall = {
                              ...tool,
                              output: streamPart.output,
                              status: streamPart.output.success
                                ? "completed"
                                : "error",
                            };
                            updated.set(streamPart.toolCallId, updatedTool);

                            // Update message with the latest tool call in contentParts
                            setMessages((prevMessages) =>
                              prevMessages.map((msg) =>
                                msg.id === assistantMessageId &&
                                msg.role === "assistant"
                                  ? {
                                      ...msg,
                                      contentParts: msg.contentParts.map(
                                        (part) =>
                                          part.type === "tool_call" &&
                                          part.toolCall?.id ===
                                            streamPart.toolCallId
                                            ? { ...part, toolCall: updatedTool }
                                            : part
                                      ),
                                    }
                                  : msg
                              )
                            );
                          }
                          return updated;
                        });
                        break;

                      case "finish-step":
                        console.log("✅ Step finished");
                        break;

                      case "finish":
                        console.log("🏁 Generation finished");
                        setIsStreaming(false);
                        break;

                      case "error":
                        console.error("❌ Stream error:", streamPart);
                        addMessage(
                          "system",
                          `❌ Stream error: ${streamPart.error}`
                        );
                        break;

                      default:
                        console.log(
                          "🔍 Unknown stream part type:",
                          streamPart.type,
                          streamPart
                        );
                        break;
                    }
                  } catch (parseError) {
                    console.error(
                      "Failed to parse stream data:",
                      parseError,
                      uiChunk
                    );
                  }
                } else {
                  // Handle non-data chunks (like empty lines)
                  console.log("🔍 Non-data chunk:", uiChunk);
                }
              } else if (eventData.type === "stream-chunk") {
                // Keep legacy support for regular chunks
                const chunk = eventData.data.params.chunk;
                console.log("📝 Adding legacy chunk:", chunk);

                // Update current text segment
                setCurrentTextSegment((prev) => prev + chunk);
                streamedContent += chunk;

                // Update the assistant message with new content using contentParts
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: "",
                          contentParts: (() => {
                            const parts = [...msg.contentParts];
                            const lastPart = parts[parts.length - 1];

                            if (lastPart && lastPart.type === "text") {
                              // Update the current text segment
                              parts[parts.length - 1] = {
                                ...lastPart,
                                content: lastPart.content + chunk,
                              };
                            } else {
                              // Start new text segment
                              parts.push({ type: "text", content: chunk });
                            }

                            return parts;
                          })(),
                        }
                      : msg
                  )
                );
              } else if (eventData.type === "stream-complete") {
                console.log("🏁 Final response received");
                setIsStreaming(false);
              } else if (eventData.type === "stream-error") {
                console.error("❌ Stream error:", eventData.data.error);
                addMessage(
                  "system",
                  `❌ Stream error: ${eventData.data.error.message}`
                );
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming failed:", error);
      addMessage(
        "system",
        `❌ Streaming failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handlePing = async () => {
    try {
      const result = await rpcClient.call("system.ping");
      addMessage(
        "system",
        `🏓 Ping successful!
Status: ${result.status}
Server: ${result.server}
Time: ${result.timestamp}`
      );
    } catch (error) {
      console.error("Ping failed:", error);
      addMessage(
        "system",
        `❌ Ping failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleStreamTest = async () => {
    try {
      setIsLoading(true);
      setDebugEvents([]); // Clear previous debug events
      setCurrentToolCalls(new Map()); // Clear previous tool calls
      addMessage("system", "🌊 Starting streaming RPC test...");

      // Create an assistant message that will be updated with streamed content
      const assistantMessageId = Date.now().toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        contentParts: [],
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Make streaming RPC call using EventSource (SSE)
      const rpcRequest = {
        jsonrpc: "2.0",
        method: "ai.streamText",
        params: {
          messages: [
            {
              role: "user",
              content:
                "Explain JSON RPC streaming in simple terms with examples",
            },
          ],
          maxSteps: 5,
        },
        id: Date.now(),
      };

      const response = await fetch("/api/chat-rpc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rpcRequest),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedContent = "";

      console.log("🌊 Starting to read stream...");

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("🏁 Stream completed");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));
              console.log("📦 Received event:", eventData);

              if (eventData.type === "rpc-response") {
                console.log("🎯 Initial RPC response:", eventData.data);
                addMessage(
                  "system",
                  `✅ Stream initiated with ID: ${eventData.data.result.streamId}`
                );
              } else if (eventData.type === "stream-chunk") {
                const chunk = eventData.data.params.chunk;
                console.log("📝 Stream chunk:", chunk);

                // Update current text segment
                setCurrentTextSegment((prev) => prev + chunk);
                streamedContent += chunk;

                // Update the assistant message with new content using contentParts
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: "",
                          contentParts: (() => {
                            const parts = [...msg.contentParts];
                            const lastPart = parts[parts.length - 1];

                            if (lastPart && lastPart.type === "text") {
                              // Update the current text segment
                              parts[parts.length - 1] = {
                                ...lastPart,
                                content: lastPart.content + chunk,
                              };
                            } else {
                              // Start new text segment
                              parts.push({ type: "text", content: chunk });
                            }

                            return parts;
                          })(),
                        }
                      : msg
                  )
                );
              } else if (eventData.type === "stream-complete") {
                console.log("🏁 Stream completed:", eventData.data);
                setIsStreaming(false);
              } else if (eventData.type === "stream-error") {
                console.error("❌ Stream error:", eventData.data.error);
                addMessage(
                  "system",
                  `❌ Stream error: ${eventData.data.error.message}`
                );
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Stream test failed:", error);
      addMessage(
        "system",
        `❌ Stream test failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  // Helper functions for tool call rendering
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "executing":
        return "🔄";
      case "completed":
        return "✅";
      case "error":
        return "❌";
      default:
        return "🔧";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      case "executing":
        return "text-blue-600 bg-blue-50";
      case "completed":
        return "text-green-600 bg-green-50";
      case "error":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  // Component to display tool calls with expand/collapse
  const ToolCallDisplay = ({ toolCall }: { toolCall: ToolCall }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div
        className={`border rounded-lg p-3 mb-2 ${getStatusColor(
          toolCall.status
        )}`}
      >
        {/* Collapsed header - always visible */}
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-lg">{getStatusIcon(toolCall.status)}</span>
          <span className="font-semibold">Tool: {toolCall.name}</span>
          <span className="text-sm opacity-75">({toolCall.status})</span>
          <span className="ml-auto text-gray-400">
            {isExpanded ? "▼" : "▶"}
          </span>
        </div>

        {/* Expanded content - only visible when expanded */}
        {isExpanded && (
          <div className="mt-3">
            {toolCall.input && (
              <div className="mb-2">
                <div className="text-sm font-medium mb-1">Input:</div>
                <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                  {JSON.stringify(toolCall.input, null, 2)}
                </div>
              </div>
            )}

            {toolCall.output && (
              <div>
                <div className="text-sm font-medium mb-1">
                  {toolCall.status === "error" ? "Error:" : "Output:"}
                </div>
                {toolCall.status === "error" ? (
                  <div className="bg-red-100 p-2 rounded text-sm text-red-800">
                    {toolCall.output.error || JSON.stringify(toolCall.output)}
                  </div>
                ) : (
                  <div className="bg-gray-100 p-2 rounded text-sm font-mono whitespace-pre-wrap">
                    {toolCall.output.output ||
                      JSON.stringify(toolCall.output, null, 2)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50"
    >
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">ShikAI</h1>
              <p className="text-xs text-gray-500">AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-green-600 text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Container with resizable debug panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div
          className="flex flex-col px-4"
          style={{
            width: showDebugPanel ? `${100 - debugPanelWidth}%` : "100%",
            transition: "width 0.3s ease",
          }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-6 flex justify-center">
            <div className="w-full max-w-4xl px-6 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                    <span className="text-white text-2xl">🤖</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Welcome to ShikAI
                  </h2>
                  <p className="text-gray-600 max-w-md">
                    I'm your AI assistant, ready to help you with any questions
                    or tasks. Start a conversation by typing a message below.
                  </p>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
                    <button
                      onClick={() => setInput("What can you help me with?")}
                      className="p-3 text-left bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <span className="text-sm text-gray-700">
                        💬 What can you help me with?
                      </span>
                    </button>
                    <button
                      onClick={() => setInput("Tell me about yourself")}
                      className="p-3 text-left bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <span className="text-sm text-gray-700">
                        🤖 Tell me about yourself
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  } mb-4`}
                >
                  {message.role !== "user" && (
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                      <span className="text-white text-xs">🤖</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                      message.role === "user"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : message.role === "system"
                        ? "bg-orange-50 text-orange-800 border border-orange-200 rounded-bl-md"
                        : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
                    }`}
                  >
                    {message.role !== "user" && message.role !== "system" && (
                      <div className="text-xs text-gray-500 mb-1 font-medium">
                        ShikAI
                      </div>
                    )}

                    {/* Render content parts in sequence for inline tool rendering */}
                    {message.contentParts && message.contentParts.length > 0 ? (
                      <div className="mt-1">
                        {message.contentParts.map((part, index) => (
                          <div key={index}>
                            {part.type === "text" && part.content && (
                              <span className="whitespace-pre-wrap">
                                {part.content}
                              </span>
                            )}
                            {part.type === "tool_call" && part.toolCall && (
                              <div className="my-2">
                                <ToolCallDisplay toolCall={part.toolCall} />
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Show typing indicator inside the last assistant message when streaming */}
                        {isStreaming &&
                          message.role === "assistant" &&
                          messages.indexOf(message) === messages.length - 1 && (
                            <div className="flex items-center space-x-2 mt-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "0.1s" }}
                                ></div>
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "0.2s" }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">
                                typing...
                              </span>
                            </div>
                          )}
                      </div>
                    ) : (
                      // Fallback to regular content if contentParts is empty
                      <div>
                        {message.content && (
                          <div className="whitespace-pre-wrap mb-2">
                            {message.content}
                          </div>
                        )}
                        {/* Show typing indicator inside the last assistant message when streaming */}
                        {isStreaming &&
                          message.role === "assistant" &&
                          messages.indexOf(message) === messages.length - 1 && (
                            <div className="flex items-center space-x-2 mt-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "0.1s" }}
                                ></div>
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "0.2s" }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">
                                typing...
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Show initial typing indicator when loading (no messages yet) */}
              {isLoading && messages.length === 0 && (
                <div className="flex justify-start mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3 mt-1">
                    <span className="text-white text-xs">🤖</span>
                  </div>
                  <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-md max-w-[75%]">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">typing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-100 bg-white p-4 relative">
            <div className="flex items-center space-x-3 max-w-4xl mx-auto">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleStreamMessage();
                    }
                  }}
                  placeholder="Message ShikAI..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[48px] max-h-32 overflow-y-auto scrollbar-hide"
                  disabled={isLoading}
                  rows={1}
                  style={{
                    height: "auto",
                    minHeight: "48px",
                    maxHeight: "128px",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height =
                      Math.min(target.scrollHeight, 128) + "px";
                  }}
                />
              </div>
              <button
                onClick={handleStreamMessage}
                disabled={isLoading || isStreaming || !input.trim()}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              >
                {isLoading || isStreaming ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Debug Controls - Right Bottom */}
            {!showDebugPanel && (
              <div className="absolute bottom-2 right-4">
                <button
                  onClick={() => setShowDebugPanel(true)}
                  className="px-3 py-1 rounded text-xs transition-all bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Show Debug ({debugEvents.length})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        {showDebugPanel && (
          <div
            className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize relative group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-200/50" />
          </div>
        )}

        {/* Debug Panel */}
        {showDebugPanel && (
          <div
            className="bg-gray-900 text-green-400 flex flex-col"
            style={{ width: `${debugPanelWidth}%` }}
          >
            <div className="bg-gray-800 text-white px-4 py-3 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Debug Panel ({debugEvents.length} events)
                </h3>
                <button
                  onClick={() => setShowDebugPanel(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {debugEvents.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No debug events yet
                </div>
              ) : (
                debugEvents.slice(-20).map((event, index) => (
                  <div
                    key={index}
                    className="mb-3 border-l-2 border-green-500 pl-3 py-1"
                  >
                    <div className="text-yellow-400 text-xs mb-1">
                      [{event.timestamp.split("T")[1].split(".")[0]}]{" "}
                      {event.type}
                    </div>
                    <div className="text-green-300 text-xs break-words">
                      {JSON.stringify(event.data, null, 2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

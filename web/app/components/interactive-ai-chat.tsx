"use client";

import { useState } from "react";
import PermissionDialog from "./permission-dialog";

interface PermissionData {
  action: string;
  command?: string;
  risks: string;
  reason: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
}

export default function InteractiveAIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] =
    useState<PermissionData | null>(null);
  const [pendingMessages, setPendingMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Call the interactive API that can handle permissions
      const response = await fetch("/api/chat-interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages,
          pendingApproval: null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Check if AI is requesting permission
      if (data.requiresPermission) {
        setPendingPermission(data.permissionData);
        setPendingMessages(currentMessages);
        // Don't add the response yet, wait for user decision
      } else {
        // Normal response, add to messages
        const assistantMessage = { role: "assistant", content: data.content };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Interactive AI API error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionApprove = async () => {
    if (!pendingPermission) return;

    setIsLoading(true);
    try {
      // Send approval back to API
      const response = await fetch("/api/chat-interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: pendingMessages,
          pendingApproval: {
            approved: true,
            permissionData: pendingPermission,
          },
        }),
      });

      const data = await response.json();

      if (data.content) {
        const assistantMessage = { role: "assistant", content: data.content };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPendingPermission(null);
      setPendingMessages([]);
      setIsLoading(false);
    }
  };

  const handlePermissionDeny = () => {
    // Add a denial response
    const denialMessage = {
      role: "assistant",
      content:
        "I understand. I won't proceed with that action. Is there anything else I can help you with?",
    };
    setMessages((prev) => [...prev, denialMessage]);

    setPendingPermission(null);
    setPendingMessages([]);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            🛡️ Interactive AI Chat
            <span className="text-xs font-normal bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              With Permissions
            </span>
          </h1>
          <a
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
          >
            🤖 Streaming
          </a>
        </div>
      </header>

      {/* Messages Container */}
      <main className="flex-1 overflow-hidden pt-20 pb-24">
        <div className="h-full max-w-4xl mx-auto px-4">
          <div className="h-full overflow-y-auto py-4 space-y-4 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-gray-500">
                <div>
                  <div className="text-4xl mb-3">🛡️</div>
                  <h2 className="text-lg font-semibold mb-2">
                    Interactive AI with Permissions
                  </h2>
                  <p className="text-gray-400 max-w-md mx-auto text-sm">
                    This AI will ask for your permission before taking
                    potentially risky actions.
                    <br />
                    <span className="text-purple-600 text-xs">
                      ✨ Full interactive permission flow
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-3xl px-4 py-3 rounded-2xl ${
                      message.role === "user"
                        ? "bg-purple-600 text-white ml-auto"
                        : "bg-white text-gray-800 shadow-sm border border-gray-200"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                        🛡️ Interactive AI
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 shadow-sm border border-gray-200 max-w-3xl px-4 py-3 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                    🛡️ Interactive AI
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                    {pendingPermission
                      ? "Processing your decision..."
                      : "Thinking..."}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="bg-red-50 text-red-800 border border-red-200 max-w-3xl px-4 py-3 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-sm text-red-600">
                    ❌ Error
                  </div>
                  <div>{error}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fixed Bottom Input */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-white/90 via-white/80 to-transparent backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message here..."
                disabled={isLoading || pendingPermission !== null}
                className="flex-1 border-0 bg-transparent focus:outline-none text-gray-800 placeholder-gray-400 text-lg"
              />
              <button
                type="submit"
                disabled={
                  !input.trim() || isLoading || pendingPermission !== null
                }
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-colors font-medium flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </>
                ) : (
                  <>Send 🛡️</>
                )}
              </button>
            </form>
          </div>
        </div>
      </footer>

      {/* Permission Dialog */}
      {pendingPermission && (
        <PermissionDialog
          permissionData={pendingPermission}
          onApprove={handlePermissionApprove}
          onDeny={handlePermissionDeny}
          isVisible={true}
        />
      )}
    </div>
  );
}

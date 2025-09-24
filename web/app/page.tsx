"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";

export default function ChatPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      streamProtocol: "text",
      api: "/api/chat-stream",
      onError: (error) => {
        console.error("❌ Chat error:", error.message);
      },
    });

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Generate conversation title from first user message
  const firstUserMessage = messages.find((m) => m.role === "user");
  const conversationTitle = firstUserMessage
    ? firstUserMessage.content.substring(0, 50) +
      (firstUserMessage.content.length > 50 ? "..." : "")
    : "New Conversation";

  const handleNewChat = () => {
    window.location.reload();
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              🤖 ShikAI
              <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                Streaming
              </span>
            </h1>
            <p className="text-gray-600 text-xs">{conversationTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/simple"
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
            >
              ⚡ Simple
            </a>
            <a
              href="/interactive"
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
            >
              🛡️ Interactive
            </a>
            <button
              onClick={handleNewChat}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
            >
              ✨ New Chat
            </button>
          </div>
        </div>
      </header>

      {/* Chat Messages Container - Middle Section */}
      <main className="flex-1 overflow-hidden pt-20 pb-24">
        <div className="h-full max-w-4xl mx-auto px-4">
          <div className="h-full overflow-y-auto py-4 space-y-4 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-gray-500">
                <div>
                  <div className="text-4xl mb-3">💬</div>
                  <h2 className="text-lg font-semibold mb-2">
                    Start a streaming conversation
                  </h2>
                  <p className="text-gray-400 max-w-md mx-auto text-sm">
                    Messages will stream in real-time as they're generated.
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
                        ? "bg-blue-600 text-white ml-auto"
                        : "bg-white text-gray-800 shadow-sm border border-gray-200"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                        🤖 ShikAI
                      </div>
                    )}
                    {/* Show loading bar if this is the last message and we're streaming */}
                    {message.role === "assistant" &&
                      index === messages.length - 1 &&
                      isLoading && (
                        <div className="mb-3">
                          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 animate-pulse rounded-full"></div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Streaming...
                          </div>
                        </div>
                      )}
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))
            )}

            {error && (
              <div className="flex justify-start">
                <div className="bg-red-50 text-red-800 border border-red-200 max-w-3xl px-4 py-3 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-sm text-red-600">
                    ❌ Error
                  </div>
                  <div>{error.message}</div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
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
                onChange={handleInputChange}
                placeholder="Type your message here..."
                disabled={isLoading}
                className="flex-1 border-0 bg-transparent focus:outline-none text-gray-800 placeholder-gray-400 text-lg"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-colors font-medium flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Streaming...
                  </>
                ) : (
                  <>Send ✨</>
                )}
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}

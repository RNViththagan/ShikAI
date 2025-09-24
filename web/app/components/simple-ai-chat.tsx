"use client";

import { useState } from "react";

export default function SimpleAIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage = { role: "assistant", content: data.content };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message);
      console.error("Simple AI API error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            ⚡ Simple AI Chat
            <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-1 rounded-full">
              generateText
            </span>
          </h1>
        </div>
      </header>

      {/* Messages Container */}
      <main className="flex-1 overflow-hidden pt-20 pb-24">
        <div className="h-full max-w-4xl mx-auto px-4">
          <div className="h-full overflow-y-auto py-4 space-y-4 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-gray-500">
                <div>
                  <div className="text-4xl mb-3">⚡</div>
                  <h2 className="text-lg font-semibold mb-2">
                    Simple AI Generation
                  </h2>
                  <p className="text-gray-400 max-w-md mx-auto text-sm">
                    Using generateText API for complete responses.
                    <br />
                    <span className="text-green-600 text-xs">
                      ✅ Secure server-side processing
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
                        ? "bg-green-600 text-white ml-auto"
                        : "bg-white text-gray-800 shadow-sm border border-gray-200"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                        ⚡ Simple AI
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
                    ⚡ Simple AI
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                    Generating complete response...
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
                disabled={isLoading}
                className="flex-1 border-0 bg-transparent focus:outline-none text-gray-800 placeholder-gray-400 text-lg"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-colors font-medium flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Generating...
                  </>
                ) : (
                  <>Send ⚡</>
                )}
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}

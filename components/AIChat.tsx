"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type AIChatProps = {
  endpoint?: string;
};

export function AIChat({ endpoint = "/api/chat" }: AIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: newMessages,
        }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      const data = await res.json();
      console.log("API /api/chat returned:", data);
      const assistantText =
        data?.answer ??
        data?.response ??
        data?.reply ??
        data?.content ??
        (typeof data === "string" ? data : "");

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: assistantText || "No response received.",
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Sorry, something went wrong on my end. Mind trying that again in a bit?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-black text-white shadow-lg flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-white/60"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open portfolio chat"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 right-6 w-96 max-w-[95vw] h-[520px] bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden border border-neutral-200"
          >
            {/* Header */}
            <div className="bg-black text-white px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-sm">
                  Ask my portfolio anything
                </h3>
                <p className="text-xs text-neutral-300">
                  Projects, tools, background, hobbies
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hover:opacity-70 transition-opacity"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-neutral-50/60">
              {messages.length === 0 && (
                <div className="text-center text-neutral-500 text-xs mt-6 px-3">
                  <p>
                    Try things like:{" "}
                    <span className="font-medium">“Projects by Manthan”</span>{" "}
                    or{" "}
                    <span className="font-medium">
                      “Work experiece of Manthan”
                    </span>
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-black text-white"
                        : "bg-white text-black border border-neutral-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-neutral-200 rounded-2xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-neutral-200 px-3 py-3 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about the work…"
                  className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-xs focus:outline-none focus:border-black"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="h-9 w-9 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Optional easter-egg note – commented out so people can keep or delete */}
            {/*
              // If this starter helped you land interviews or make your portfolio clearer,
              // consider tossing a little love back into the universe:
              // endorse another designer, share the guide, or leave a star on the repo. 💫
            */}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Send,
  MessageSquare,
  Trash2,
  Loader2,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chat as chatApi } from "../lib/api";
import type { ChatSession, ChatMessage } from "../lib/api";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions
  useEffect(() => {
    chatApi
      .listSessions()
      .then(({ sessions }) => {
        setSessions(sessions);
        if (sessions.length > 0) setActiveSession(sessions[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingSessions(false));
  }, []);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSession) {
      setMessages([]);
      return;
    }
    chatApi
      .getMessages(activeSession)
      .then(({ messages }) => setMessages(messages))
      .catch(console.error);
  }, [activeSession]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const createSession = async () => {
    try {
      const { session } = await chatApi.createSession();
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session.id);
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await chatApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        setActiveSession(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || streaming) return;

    const userMessage = input.trim();
    setInput("");
    setStreaming(true);
    setStreamingText("");

    // Add user message to UI immediately
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId: activeSession,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let accumulated = "";
      for await (const chunk of chatApi.stream(activeSession, userMessage)) {
        accumulated += chunk;
        setStreamingText(accumulated);
      }

      // Add assistant message
      const assistantMsg: ChatMessage = {
        id: `temp-${Date.now()}-ai`,
        sessionId: activeSession,
        role: "assistant",
        content: accumulated,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingText("");

      // Update session title in sidebar
      if (messages.length === 0) {
        const title =
          userMessage.slice(0, 60) + (userMessage.length > 60 ? "..." : "");
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSession ? { ...s, title } : s))
        );
      }
    } catch (e) {
      console.error("Stream error:", e);
      setStreamingText("");
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={createSession}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {loadingSessions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={20} />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              No conversations yet
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer mb-1 ${
                  activeSession === session.id
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setActiveSession(session.id)}
              >
                <MessageSquare size={14} className="shrink-0" />
                <span className="flex-1 text-sm truncate">{session.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!activeSession ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                FinWise AI Advisor
              </h2>
              <p className="text-gray-500 text-sm mb-4 max-w-md">
                Ask me about investments, savings, mutual funds, tax planning,
                or any financial topic relevant to Indian markets.
              </p>
              <button
                onClick={createSession}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Start a Conversation
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {messages.length === 0 && !streaming && (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">
                    Start the conversation by asking a financial question
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {[
                      "How should I start investing in mutual funds?",
                      "What's the best way to save for retirement in India?",
                      "Explain SIP vs lump sum investment",
                      "How to save tax under Section 80C?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                        }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {streaming && streamingText && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-xs shrink-0">
                    AI
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl">
                    <div className="text-sm text-gray-800 prose prose-sm prose-emerald max-w-none">
                      <Markdown remarkPlugins={[remarkGfm]}>{streamingText}</Markdown>
                      <span className="inline-block w-1.5 h-4 bg-emerald-500 animate-pulse ml-0.5" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-end gap-3 max-w-4xl mx-auto">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about investments, savings, tax planning..."
                  rows={1}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                  style={{ maxHeight: 120 }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                  className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {streaming ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-2">
                FinWise AI provides educational guidance, not certified financial
                advice.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
          isUser
            ? "bg-blue-100 text-blue-700"
            : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className={`rounded-2xl px-4 py-3 max-w-2xl ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm prose-emerald max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

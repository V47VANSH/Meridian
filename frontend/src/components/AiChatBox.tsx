import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { api, ApiError } from "../api/client";
import { SUGGESTIONS, destinationFor, type AiDestination } from "../lib/aiRoutes";
import type { components } from "../api/generated/schema";
import type { Role } from "../lib/constants";

type AIAssistantResponse = components["schemas"]["AIAssistantResponse"];

interface ChatMessage {
  id: string;
  sender: "user" | "system";
  text: string;
  timestamp: Date;
  /** Where this reply leads, when the intent maps to a screen for this role. */
  destination?: AiDestination | null;
}

const WELCOME: Record<Role, string> = {
  RESIDENT_OWNER:
    "Welcome to Meridian. Tell me what you need — booking a facility, raising a complaint, issuing a guest pass, checking your dues — and I'll take you to the right place.",
  SOCIETY_OFFICIAL:
    "Management console ready. Ask me to triage complaints, post an announcement, review the booking schedule or open the resident directory.",
  NON_RESIDENT_OWNER:
    "Remote property view ready. Ask me about your dues, your flat's complaint status, guest passes or society announcements.",
  SECURITY_GUARD:
    "Gate console ready. Ask me to verify a visitor pass or show the SOS inbox.",
  MAINTENANCE_STAFF: "Staff console ready. Ask me to show the complaints assigned to you.",
};

let messageCounter = 0;
function nextId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

/**
 * The assistant works out what someone wants and hands them to the screen that
 * does it.
 *
 * It previously carried fifteen inline cards, each a second implementation of
 * a page, all reading a module-level fixture store. A resident who booked a
 * slot in the chat saw a confirmation the calendar knew nothing about, and the
 * property card fell back to a fabricated resident when it could not find a
 * match. Routing to the real screens means what the chat leads to and what the
 * app shows are the same thing.
 */
export default function AiChatBox() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          sender: "system",
          text: WELCOME[user.role],
          timestamp: new Date(),
        },
      ]);
    }
  }, [user, isOpen, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (!user) return null;
  const role = user.role;

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isLoading) return;

    if (!textToSend) setInputValue("");

    setMessages((prev) => [
      ...prev,
      { id: nextId("user"), sender: "user", text, timestamp: new Date() },
    ]);
    setIsLoading(true);

    try {
      const response = await api.post<AIAssistantResponse>("/v1/ai/assistant", { prompt: text });
      setMessages((prev) => [
        ...prev,
        {
          id: nextId("sys"),
          sender: "system",
          text: response.reply,
          timestamp: new Date(),
          destination: destinationFor(role, response.card_type),
        },
      ]);
    } catch (error) {
      // The assistant is a convenience, but saying nothing would leave the
      // message looking sent and unanswered.
      const message =
        error instanceof ApiError
          ? `I couldn't reach the assistant just now (${error.message})`
          : "I couldn't reach the assistant just now.";
      setMessages((prev) => [
        ...prev,
        { id: nextId("sys"), sender: "system", text: message, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function goTo(destination: AiDestination) {
    setIsOpen(false);
    navigate(destination.path);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void handleSend();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-5 right-5 z-40 flex items-center gap-2 rounded-sm border border-blueprint-600 bg-blueprint-950/90 px-3.5 py-2 text-xs font-medium text-ink-100 hover:border-signal hover:text-signal transition-all duration-200 shadow-xl active:scale-95"
      >
        <span className="font-mono text-[10px] text-signal font-bold uppercase tracking-wider">
          AI-01
        </span>
        <span>Meridian AI</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-blueprint-950/40 backdrop-blur-xs transition-opacity duration-200"
          />

          <div className="relative w-[400px] h-full bg-blueprint-900 border-l border-blueprint-700 shadow-2xl flex flex-col z-10 bp-canvas">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500" />

            <div className="px-5 py-4 border-b border-blueprint-700 flex items-center justify-between bg-blueprint-950/60">
              <div>
                <p className="bp-eyebrow">SYS-BOT / INTERACTION</p>
                <h3 className="font-display font-semibold text-base text-signal">
                  Meridian AI Assistant
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-ink-500 hover:text-signal font-mono text-lg p-1 transition"
                title="Close"
              >
                [×]
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 font-body">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-mono text-ink-500">
                      {m.sender === "user" ? "USER" : "AI-SYSTEM"}
                    </span>
                    <span className="text-[9px] font-mono text-ink-600">
                      {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div
                    className={`rounded-sm px-3.5 py-2.5 max-w-[85%] text-xs leading-relaxed ${
                      m.sender === "user"
                        ? "bg-blueprint-700/80 border border-blueprint-600 text-ink-100 rounded-tr-none"
                        : "bg-blueprint-950/60 border border-blueprint-800 text-ink-300 rounded-tl-none"
                    }`}
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {m.text}
                  </div>

                  {m.destination && (
                    <button
                      onClick={() => goTo(m.destination as AiDestination)}
                      className="mt-2 w-[85%] rounded-sm border border-signal/40 bg-signal/10 px-3 py-2 text-left text-xs font-mono text-signal hover:bg-signal/20 transition"
                    >
                      → {m.destination.label}
                    </button>
                  )}
                </div>
              ))}

              {isLoading && (
                <p className="text-[10px] font-mono text-ink-500">AI-SYSTEM is thinking…</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5 bg-blueprint-950/40 border-t border-blueprint-800">
              {SUGGESTIONS[role].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => void handleSend(suggestion)}
                  disabled={isLoading}
                  className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-blueprint-700 bg-blueprint-950/60">
              <form onSubmit={onSubmit} className="flex gap-2">
                <input
                  required
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask AI to book a slot, raise a ticket…"
                  className="input-field flex-1 text-xs py-2 px-3 border-blueprint-600 bg-blueprint-950/80 focus:border-signal"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary px-3 text-xs flex items-center justify-center font-bold disabled:opacity-50"
                  title="Send message"
                >
                  ↵
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

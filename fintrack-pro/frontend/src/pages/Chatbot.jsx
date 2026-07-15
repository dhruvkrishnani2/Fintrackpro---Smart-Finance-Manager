import { useEffect, useRef, useState } from "react";
import client from "../api/client.js";

const SUGGESTIONS = [
  "What's my balance?",
  "How much did I spend this month?",
  "Am I over budget?",
  "How are my goals doing?",
  "Forecast next month's cash flow",
];

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [llmEnabled, setLlmEnabled] = useState(null);
  const [mode, setMode] = useState("offline"); // "offline" | "online" — which mode the user has selected
  const bottomRef = useRef(null);

  const loadHistory = async () => {
    const [{ data: history }, { data: status }] = await Promise.all([
      client.get("/api/chatbot/history"),
      client.get("/api/chatbot/status"),
    ]);
    setMessages(history);
    setLlmEnabled(status.llm_enabled);
    // Default to online mode automatically if the server has it configured.
    setMode(status.llm_enabled ? "online" : "offline");
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() },
    ]);
    setInput("");
    setSending(true);
    try {
      const { data } = await client.post("/api/chatbot/message", { message: content, mode });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-r`, role: "assistant", content: data.reply, created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-e`,
          role: "assistant",
          content: "Sorry, something went wrong answering that. Try again?",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send();
  };

  const clearHistory = async () => {
    if (!confirm("Clear this conversation?")) return;
    await client.delete("/api/chatbot/history");
    setMessages([]);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Ask FinTrack</p>
          <h1 className="font-display text-3xl text-ink">Assistant</h1>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="text-xs text-slate-text hover:text-coral">
            Clear chat
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-ink/15 p-0.5 bg-white">
          <button
            onClick={() => setMode("offline")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "offline" ? "bg-ink text-paper" : "text-slate-text hover:text-ink"
            }`}
          >
            Offline
          </button>
          <button
            onClick={() => llmEnabled && setMode("online")}
            disabled={!llmEnabled}
            title={!llmEnabled ? "No Gemini API key configured on the server" : ""}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "online" ? "bg-emerald text-white" : "text-slate-text hover:text-ink"
            } ${!llmEnabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            Online
          </button>
        </div>
        <span className="text-xs text-slate-text">
          {mode === "online" ? "Free-form questions answered by Gemini, using your real numbers." : "Fast, rule-based answers — no AI calls."}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto my-4 bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-5">
        {loading ? (
          <p className="text-slate-text text-sm">Loading…</p>
        ) : messages.length === 0 ? (
          <div>
            <p className="text-slate-text text-sm mb-4">
              Ask me anything about your finances — I'll answer using your actual transactions,
              budgets, and goals.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-ink/15 text-slate-text hover:border-emerald hover:text-emerald transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role !== "user" && (
                  <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-gradient-to-br from-emerald-light to-emerald text-white text-xs font-bold mb-0.5">
                    F
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line shadow-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-ink to-ink-light text-paper rounded-br-sm"
                      : "bg-paper text-ink border border-ink/10 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-end gap-2 justify-start">
                <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-gradient-to-br from-emerald-light to-emerald text-white text-xs font-bold mb-0.5">
                  F
                </span>
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm bg-paper text-slate-text border border-ink/10 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-text/40 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-text/40 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-text/40 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your spending, budgets, goals…"
          className="flex-1 px-3 py-2.5 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  direction: "in" | "out";
  body: string;
  channel: string;
}

interface AgentChatPanelProps {
  initialMessages: ChatMessage[];
  initialPoints: number;
}

const FAILURE_APOLOGY =
  "Maaf, ada kendala teknis di sisi kami. Coba kirim pesan itu lagi sebentar ya.";

export function AgentChatPanel({ initialMessages, initialPoints }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [points, setPoints] = useState(initialPoints);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;

    setText("");
    setSending(true);
    setMessages((prev) => [...prev, { direction: "in", body, channel: "web" }]);

    let reply = FAILURE_APOLOGY;
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = await res.json().catch(() => null);
      if (data?.reply) reply = data.reply;
      if (typeof data?.pointsBalance === "number") setPoints(data.pointsBalance);
    } catch {
      /* keep the apology */
    }

    setMessages((prev) => [...prev, { direction: "out", body: reply, channel: "web" }]);
    setSending(false);
  }

  return (
    <div className="mt-8 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex items-center justify-between">
        <p className="font-medium text-ink">Chat dengan asisten</p>
        <span className="rounded-full bg-gold-400/15 px-3 py-1 text-xs font-semibold text-gold-500">
          {points.toLocaleString("id-ID")} poin
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Percakapan ini menyambung dengan WhatsApp — asisten mengingat keduanya.
      </p>

      <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            Belum ada percakapan. Mulai dengan menanyakan apa saja soal toko Anda.
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.direction === "in" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.direction === "in"
                  ? "bg-gold-400/15 text-ink"
                  : "bg-navy-900/5 text-ink ring-1 ring-navy-900/10"
              }`}
            >
              {m.body}
              {m.channel === "whatsapp" && (
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted">
                  via WhatsApp
                </span>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-navy-900/5 px-4 py-2 text-sm text-muted ring-1 ring-navy-900/10">
              Asisten sedang mengetik…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-5 flex gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          maxLength={4000}
          placeholder="Tulis pesan… (Enter untuk kirim)"
          className="flex-1 resize-none rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          className="self-end rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          Kirim
        </button>
      </div>
    </div>
  );
}

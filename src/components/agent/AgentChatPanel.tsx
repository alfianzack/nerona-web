"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
    <Card className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-title-2 text-ink">Chat dengan asisten</p>
        {/* Saldo poin adalah uang, dan itu satu-satunya sebab emas muncul di
            panel ini. */}
        <Badge tone="points">{points.toLocaleString("id-ID")} poin</Badge>
      </div>
      <p className="mt-1 text-caption text-muted">
        Percakapan ini menyambung dengan WhatsApp — asisten mengingat keduanya.
      </p>

      <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="py-8 text-center text-body text-muted">
            Belum ada percakapan. Mulai dengan menanyakan apa saja soal toko Anda.
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.direction === "in" ? "justify-end" : "justify-start"}`}
          >
            {/* Gelembung pengguna dulu bertinta emas. Emas di dalam aplikasi
                menandai uang, bukan siapa yang bicara, jadi pemisah kedua sisi
                turun ke satu warna aksen melawan permukaan cekung. */}
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-card px-4 py-2 text-body ${
                m.direction === "in"
                  ? "bg-accent/10 text-ink"
                  : "bg-surface-sunken text-ink ring-1 ring-border"
              }`}
            >
              {m.body}
              {m.channel === "whatsapp" && (
                <span className="mt-1 block font-mono text-label uppercase text-muted">
                  via WhatsApp
                </span>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-card bg-surface-sunken px-4 py-2 text-body text-muted ring-1 ring-border">
              Asisten sedang mengetik…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-5 flex gap-2">
        {/* Belum ada primitif untuk area teks bertingkat, jadi kelasnya sengaja
            dicocokkan dengan Input supaya keduanya tidak berbeda tinggi cincin
            dan warna fokusnya. */}
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
          className="flex-1 resize-none rounded-control bg-surface px-3.5 py-2.5 text-body text-ink ring-1 ring-border transition placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <Button
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          className="self-end"
        >
          Kirim
        </Button>
      </div>
    </Card>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

const STORAGE_KEY = "muni-chat-conversation-id";

const GREETING: ChatMessage = {
  id: "greeting",
  role: "ASSISTANT",
  content:
    "¡Hola! 👋 Soy el asistente virtual de la municipalidad. Puedo responder consultas frecuentes, registrar reclamos y contarte el estado de un caso. ¿En qué te ayudo?",
  createdAt: new Date().toISOString(),
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatWidget() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem(STORAGE_KEY);

    Promise.resolve(stored ? fetch(`/api/chat/${stored}`) : null)
      .then((res) => (res?.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (stored) setConversationId(stored);
        if (data?.messages?.length) {
          setMessages(
            data.messages.map((m: { role: string; content: string; createdAt: string }, i: number) => ({
              id: `${stored}-${i}`,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          );
        }
        setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId ?? undefined,
        }),
      });

      if (!res.ok) throw new Error("request failed");

      const data = await res.json();

      if (!conversationId) {
        localStorage.setItem(STORAGE_KEY, data.conversationId);
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          role: "ASSISTANT",
          content: data.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "ASSISTANT",
          content: "Perdón, tuvimos un problema técnico. Probá de nuevo en un momento.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }

  return (
    <div className="wac-shell">
      <header className="wac-header">
        <div className="wac-avatar">🏛️</div>
        <div className="wac-header-info">
          <div className="wac-header-name">Municipalidad · Asistente</div>
          <div className="wac-header-status">
            {sending ? "escribiendo..." : "en línea"}
          </div>
        </div>
      </header>

      <div className="wac-messages">
        <span className="wac-day-divider">HOY</span>

        {!loadingHistory &&
          messages.map((m) => (
            <div
              key={m.id}
              className={`wac-row ${m.role === "USER" ? "user" : "assistant"}`}
            >
              <div
                className={`wac-bubble ${m.role === "USER" ? "user" : "assistant"}`}
              >
                {m.content}
                <span className="wac-bubble-time">{formatTime(m.createdAt)}</span>
              </div>
            </div>
          ))}

        {sending && (
          <div className="wac-row assistant">
            <div className="wac-bubble assistant">
              <span className="wac-typing">
                <span className="wac-typing-dot" />
                <span className="wac-typing-dot" />
                <span className="wac-typing-dot" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <p className="wac-disclaimer">
        Demo del canal de WhatsApp · las respuestas las genera un asistente de IA
      </p>

      <div className="wac-composer">
        <textarea
          ref={textareaRef}
          className="wac-input"
          placeholder="Escribí un mensaje"
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <button
          className="wac-send"
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          aria-label="Enviar"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useMemo, useState } from "react";

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
};

interface ChatRoomProps {
  chatId: string;
  characterName: string;
  initialMessages: Message[];
}

function splitSseEvents(buffer: string) {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  return {
    events: parts,
    remainder,
  };
}

function readAssistantDelta(event: string) {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data || data === "[DONE]") {
    return "";
  }

  try {
    const payload = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return payload.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

export function ChatRoom({ chatId, characterName, initialMessages }: ChatRoomProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderedMessages = useMemo(() => {
    if (!streamingMessage) {
      return messages;
    }

    return [
      ...messages,
      {
        id: "streaming",
        role: "assistant" as const,
        content: streamingMessage,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [messages, streamingMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setStreamingMessage("");

    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: draft,
      createdAt: new Date().toISOString(),
    };
    const content = draft;

    setMessages((current) => [...current, optimisticMessage]);
    setDraft("");

    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json();
        throw new Error(payload.error?.message || "Failed to send message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = splitSseEvents(buffer);
        buffer = remainder;

        for (const eventChunk of events) {
          assistantText += readAssistantDelta(eventChunk);
          setStreamingMessage(assistantText);
        }
      }

      if (assistantText.trim()) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: assistantText,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      setStreamingMessage("");
    } catch (messageError) {
      setError(messageError instanceof Error ? messageError.message : "Failed to send message.");
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      setDraft(content);
      setStreamingMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-10 grid max-w-5xl gap-6">
      <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Conversation</h2>
            <p className="mt-1 text-sm text-slate-400">Streaming replies from {characterName}</p>
          </div>
        </div>
        <div className="space-y-4">
          {renderedMessages.length ? (
            renderedMessages.map((message) => (
              <article
                key={message.id}
                className={`rounded-[1.25rem] border p-4 ${
                  message.role === "user"
                    ? "border-cyan-400/20 bg-cyan-400/10"
                    : "border-white/10 bg-slate-950/60"
                }`}
              >
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                  {message.role}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">{message.content}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-400">No messages yet. Start the conversation below.</p>
          )}
        </div>
      </section>
      <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Send a message"
            className="min-h-32 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Streaming..." : "Send message"}
          </button>
        </form>
      </section>
    </div>
  );
}
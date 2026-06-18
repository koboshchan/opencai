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
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        assistantText += decoder.decode(value, { stream: true });
        setStreamingMessage(assistantText);
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
    <div>
      <section>
        <h2>Conversation</h2>
        <p>Streaming replies from {characterName}</p>
        <div style={{ marginTop: "20px" }}>
          {renderedMessages.length ? (
            renderedMessages.map((message) => (
              <article
                key={message.id}
                style={{
                  border: "1px solid #ccc",
                  padding: "10px",
                  margin: "10px 0",
                  backgroundColor: message.role === "user" ? "#f9f9f9" : "#fff",
                }}
              >
                <p style={{ margin: "0 0 5px 0", fontSize: "0.8em", textTransform: "uppercase", color: "#666" }}>
                  {message.role}
                </p>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p>
              </article>
            ))
          ) : (
            <p>No messages yet. Start the conversation below.</p>
          )}
        </div>
      </section>
      <hr />
      <section>
        <form onSubmit={handleSubmit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Send a message"
            rows={4}
          />
          {error ? <p style={{ color: "red" }}>{error}</p> : null}
          <div style={{ marginTop: "10px" }}>
            <button type="submit" disabled={submitting}>
              {submitting ? "Streaming..." : "Send message"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
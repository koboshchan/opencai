"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { markdownToHtml } from "@/lib/markdown";
import { splitIntoBubbles, typingDelayMs } from "@/lib/texting";

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

type BubbleGroup = {
  key: string;
  role: "user" | "assistant";
  bubbles: { key: string; text: string }[];
  timestamp: string;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toGroups(messages: Message[]): BubbleGroup[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      key: message.id,
      role: message.role as "user" | "assistant",
      bubbles: splitIntoBubbles(message.content).map((text, index) => ({
        key: `${message.id}-${index}`,
        text,
      })),
      timestamp: message.createdAt,
    }))
    .filter((group) => group.bubbles.length > 0);
}

function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function ChatRoom({ chatId, characterName, initialMessages }: ChatRoomProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedBubbles, setRevealedBubbles] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const groups = toGroups(messages);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groups.length, revealedBubbles.length, isTyping]);

  async function revealBubbles(bubbles: string[]) {
    for (const bubble of bubbles) {
      setIsTyping(true);
      await delay(typingDelayMs(bubble));
      setIsTyping(false);
      setRevealedBubbles((current) => [...current, bubble]);
      await delay(150);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setRevealedBubbles([]);

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

      setIsTyping(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        assistantText += decoder.decode(value, { stream: true });
      }

      const bubbles = splitIntoBubbles(assistantText);

      if (bubbles.length) {
        await revealBubbles(bubbles);

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

      setIsTyping(false);
      setRevealedBubbles([]);
    } catch (messageError) {
      setError(messageError instanceof Error ? messageError.message : "Failed to send message.");
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      setDraft(content);
      setIsTyping(false);
      setRevealedBubbles([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col max-md:fixed max-md:inset-0 max-md:z-50 max-md:bg-white">
      {/* Compact sticky header, mobile only — the desktop header lives in page.tsx */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <Link href="/characters" className="text-xl leading-none text-gray-600" aria-label="Back to characters">
          &larr;
        </Link>
        <span className="flex-1 truncate font-semibold text-gray-900">{characterName}</span>
        <UserButton />
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto max-md:px-4 max-md:py-3 md:max-h-[65vh] md:min-h-[40vh] md:rounded-xl md:border md:border-gray-200 md:bg-white md:p-4">
        {groups.length === 0 && !isTyping ? (
          <p className="m-auto text-sm text-gray-400">Say hi to {characterName} to start texting.</p>
        ) : (
          groups.map((group) => (
            <div
              key={group.key}
              className={`flex flex-col gap-1 ${group.role === "user" ? "items-end" : "items-start"}`}
            >
              {group.bubbles.map((bubble) => (
                <div
                  key={bubble.key}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm md:max-w-[75%] [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] ${
                    group.role === "user"
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900"
                  }`}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(bubble.text) }}
                />
              ))}
            </div>
          ))
        )}

        {revealedBubbles.length > 0 || isTyping ? (
          <div className="flex flex-col items-start gap-1">
            {revealedBubbles.map((bubble, index) => (
              <div
                key={index}
                className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-900 md:max-w-[75%] [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(bubble) }}
              />
            ))}
            {isTyping ? <TypingIndicator /> : null}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {error ? <p className="mx-4 mt-2 shrink-0 text-sm text-red-600 md:mx-0">{error}</p> : null}

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-end gap-2 border-t border-gray-200 bg-white px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] md:mt-3 md:border-0 md:bg-transparent md:px-0 md:py-0 md:pb-0"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Text a message"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CharacterCard = {
  id: string;
  name: string;
  slug: string;
  description: string;
  systemPrompt: string;
  visibility: "public" | "private";
  ownerClerkUserId: string;
  tags: string[];
  updatedAt: string;
  isOwner: boolean;
};

interface CharactersDashboardProps {
  initialCharacters: CharacterCard[];
  viewerClerkUserId: string;
  isAdmin: boolean;
  enabledModelCount: number;
}

export function CharactersDashboard({
  initialCharacters,
  isAdmin,
  enabledModelCount,
}: CharactersDashboardProps) {
  const router = useRouter();
  const [characters, setCharacters] = useState(initialCharacters);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshCharacters(query?: string) {
    const endpoint = query?.trim()
      ? `/api/characters/search?query=${encodeURIComponent(query)}`
      : "/api/characters";
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error?.message || "Failed to load characters.");
      return;
    }

    setCharacters(payload.characters);
  }

  async function handleCreateCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          systemPrompt,
          visibility,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || "Failed to create character.");
      }

      setCharacters((current) => [payload.character, ...current]);
      setName("");
      setDescription("");
      setSystemPrompt("");
      setVisibility("private");
      setTags("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create character.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCharacter(characterId: string) {
    setError(null);

    const response = await fetch(`/api/characters/${characterId}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error?.message || "Failed to delete character.");
      return;
    }

    setCharacters((current) => current.filter((character) => character.id !== characterId));
  }

  async function handleStartChat(characterId: string) {
    setError(null);

    const response = await fetch(`/api/characters/${characterId}/chats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error?.message || "Failed to create chat.");
      return;
    }

    router.push(`/chats/${payload.chat.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Browse characters</h2>
            <p className="mt-1 text-sm text-slate-400">
              {enabledModelCount > 0
                ? `${enabledModelCount} enabled models available for chat.`
                : "No enabled models yet. An admin needs to sync and enable models first."}
            </p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => refreshCharacters(search)}
            placeholder="Search by name or tag"
            className="w-full max-w-xs rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="grid gap-4">
          {characters.map((character) => (
            <article
              key={character.id}
              className="rounded-[1.25rem] border border-white/10 bg-slate-950/60 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{character.name}</h3>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      {character.visibility}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{character.description}</p>
                  {character.tags.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {character.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => handleStartChat(character.id)}
                    className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
                  >
                    Start chat
                  </button>
                  {character.isOwner || isAdmin ? (
                    <button
                      onClick={() => handleDeleteCharacter(character.id)}
                      className="rounded-full border border-rose-400/40 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/10"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold">Create a character</h2>
        <p className="mt-2 text-sm text-slate-400">
          Characters store a system prompt and can be kept private or shared publicly.
        </p>
        <form onSubmit={handleCreateCharacter} className="mt-6 space-y-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Character name"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            required
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this character for?"
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            required
          />
          <textarea
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            placeholder="System prompt"
            className="min-h-40 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            required
          />
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags, comma separated"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <label className="block text-sm text-slate-300">
            Visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "public" | "private")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create character"}
          </button>
        </form>
      </section>
    </div>
  );
}
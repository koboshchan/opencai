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
  const [greeting, setGreeting] = useState("");
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
          greeting: greeting || undefined,
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
      setGreeting("");
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
    <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
      <section style={{ flex: 1.2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <div>
            <h2>Browse characters</h2>
            <p>
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
          />
        </div>
        <div>
          {characters.map((character) => (
            <article
              key={character.id}
              style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "15px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <h3>{character.name}</h3>
                    <span>({character.visibility})</span>
                  </div>
                  <p>{character.description}</p>
                  {character.tags.length ? (
                    <div style={{ marginTop: "10px" }}>
                      {character.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{ marginRight: "5px", padding: "2px 5px", background: "#eee", fontSize: "0.8em" }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div>
                  <button onClick={() => handleStartChat(character.id)}>
                    Start chat
                  </button>
                  {" "}
                  {character.isOwner || isAdmin ? (
                    <button onClick={() => handleDeleteCharacter(character.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ flex: 0.8, borderLeft: "1px solid #ccc", paddingLeft: "20px" }}>
        <h2>Create a character</h2>
        <p>
          Characters store a system prompt and can be kept private or shared publicly.
        </p>
        <form onSubmit={handleCreateCharacter}>
          <div>
            <label>Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Character name"
              required
            />
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this character for?"
              required
            />
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="System prompt"
              required
            />
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>Greeting (Official starting message)</label>
            <textarea
              value={greeting}
              onChange={(event) => setGreeting(event.target.value)}
              placeholder="Official starting message / greeting (optional)"
            />
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>Tags</label>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tags, comma separated"
            />
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>Visibility</label>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "public" | "private")}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>
          {error ? <p style={{ color: "red" }}>{error}</p> : null}
          <div style={{ marginTop: "15px" }}>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create character"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
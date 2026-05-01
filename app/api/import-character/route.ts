import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getCharacterInfo } from "@/lib/characterai";
import { toErrorResponse } from "@/lib/errors";
import { CharacterDocument } from "@/lib/types";
import { importCharacterSchema } from "@/lib/validators";

function createSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

// Helper to extract character id from various character.ai URLs
function extractCharacterId(url: string): string | null {
  try {
    // 1. Direct chat URL with id in path or query
    // e.g. https://character.ai/chat/UrHRu3M18olZwuOCgZOWZvv0Vldneh9P3jW4U7wB4P0?...
    const chatMatch = url.match(/character\.ai\/chat\/(\w+)/);
    if (chatMatch) return chatMatch[1];
    // 2. char=... in query string
    const charParam = url.match(/[?&]char=([\w-]+)/);
    if (charParam) return charParam[1];
    // 3. share.character.ai shortlink (handled in handler)
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const viewer = await requireViewer();
    const payload = importCharacterSchema.parse(await req.json());
    let charId = extractCharacterId(payload.url);

    // If not found, try to resolve share.character.ai shortlink
    if (!charId && payload.url.includes("share.character.ai")) {
      try {
        const res = await fetch(payload.url, { method: "GET", redirect: "manual" });
        const location = res.headers.get("location");
        if (location) {
          const match = location.match(/[?&]char=([\w-]+)/);
          if (match) charId = match[1];
        }
      } catch {
        return Response.json({ error: "Failed to resolve shortlink" }, { status: 400 });
      }
    }

    if (!charId) {
      return Response.json({ error: "Could not extract character id from url" }, { status: 400 });
    }

    const token = req.headers.get("x-characterai-token");
    if (!token) {
      return Response.json({ error: "Missing x-characterai-token header" }, { status: 400 });
    }

    const imported = await getCharacterInfo(charId, token);
    const db = await getDb();
    const now = new Date();
    const character: CharacterDocument = {
      ownerClerkUserId: viewer.clerkUserId,
      name: imported.name,
      slug: createSlug(imported.name),
      description: imported.title?.trim() || "Imported character",
      systemPrompt: [imported.description, imported.greeting].filter(Boolean).join("\n\n"),
      visibility: payload.visibility,
      avatarUrl: imported.avatar_file_name ? `https://characterai.io/i/80/static/avatars/${imported.avatar_file_name}` : null,
      tags: imported.categories?.slice(0, 10) ?? [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.collection<CharacterDocument>("characters").insertOne(character);

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

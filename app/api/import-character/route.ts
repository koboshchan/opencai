import { NextRequest, NextResponse } from "next/server";
import { getCharacterInfo } from "@/lib/characterai";

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

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing or invalid url" }, { status: 400 });
  }

  let charId = extractCharacterId(url);

  // If not found, try to resolve share.character.ai shortlink
  if (!charId && url.includes("share.character.ai")) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      const location = res.headers.get("location");
      if (location) {
        const match = location.match(/[?&]char=([\w-]+)/);
        if (match) charId = match[1];
      }
    } catch {
      return NextResponse.json({ error: "Failed to resolve shortlink" }, { status: 400 });
    }
  }

  if (!charId) {
    return NextResponse.json({ error: "Could not extract character id from url" }, { status: 400 });
  }

  // Fetch character info from CharacterAI (manual implementation)
  try {
    // You must provide a valid token for the CharacterAI API
    const token = req.headers.get('x-characterai-token');
    if (!token) {
      return NextResponse.json({ error: 'Missing x-characterai-token header' }, { status: 400 });
    }
    const character = await getCharacterInfo(charId, token);
    return NextResponse.json({
      id: character.external_id,
      name: character.name,
      description: character.description,
      greeting: character.greeting,
      avatar: character.avatar_file_name,
      visibility: character.visibility,
      definition: character.title,
      // ...add more fields as needed
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch character info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

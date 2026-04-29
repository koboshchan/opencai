import { CharacterDocument } from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";
import { createCharacterSchema } from "@/lib/validators";

function createSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

const activeCharacterFilter = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "all";
    const db = await getDb();
    const filter: Record<string, unknown> = {
      ...activeCharacterFilter,
    };

    if (scope === "mine") {
      filter.ownerClerkUserId = viewer.clerkUserId;
    } else if (scope === "public") {
      filter.visibility = "public";
    } else {
      filter.$and = [
        activeCharacterFilter,
        {
          $or: [
            { ownerClerkUserId: viewer.clerkUserId },
            { visibility: "public" },
          ],
        },
      ];
      delete filter.$or;
    }

    const characters = await db
      .collection<CharacterDocument>("characters")
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();

    return Response.json({
      characters: characters.map((character) => ({
        id: character._id!.toString(),
        ownerClerkUserId: character.ownerClerkUserId,
        name: character.name,
        slug: character.slug,
        description: character.description,
        systemPrompt: character.systemPrompt,
        visibility: character.visibility,
        avatarUrl: character.avatarUrl,
        tags: character.tags,
        createdAt: character.createdAt.toISOString(),
        updatedAt: character.updatedAt.toISOString(),
        isOwner: character.ownerClerkUserId === viewer.clerkUserId,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const payload = createCharacterSchema.parse(await request.json());
    const db = await getDb();
    const now = new Date();
    const character: CharacterDocument = {
      ownerClerkUserId: viewer.clerkUserId,
      name: payload.name,
      slug: createSlug(payload.name),
      description: payload.description,
      systemPrompt: payload.systemPrompt,
      visibility: payload.visibility,
      avatarUrl: payload.avatarUrl ?? null,
      tags: payload.tags,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const result = await db.collection<CharacterDocument>("characters").insertOne(character);

    return Response.json(
      {
        character: {
          id: result.insertedId.toString(),
          ...character,
          createdAt: character.createdAt.toISOString(),
          updatedAt: character.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
import { CharacterDocument } from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { updateCharacterSchema } from "@/lib/validators";

function createSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

async function getCharacter(characterId: string) {
  const db = await getDb();
  const character = await db.collection<CharacterDocument>("characters").findOne({
    _id: parseObjectId(characterId, "characterId"),
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });

  if (!character) {
    throw new ApiError(404, "Character not found.");
  }

  return character;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/characters/[characterId]">,
) {
  try {
    const viewer = await requireViewer();
    const { characterId } = await context.params;
    const character = await getCharacter(characterId);

    if (
      character.visibility === "private" &&
      character.ownerClerkUserId !== viewer.clerkUserId &&
      !viewer.user.isAdmin
    ) {
      throw new ApiError(403, "You do not have access to this character.");
    }

    return Response.json({
      character: {
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
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/characters/[characterId]">,
) {
  try {
    const viewer = await requireViewer();
    const { characterId } = await context.params;
    const character = await getCharacter(characterId);

    if (
      character.ownerClerkUserId !== viewer.clerkUserId &&
      !viewer.user.isAdmin
    ) {
      throw new ApiError(403, "You cannot edit this character.");
    }

    const payload = updateCharacterSchema.parse(await request.json());
    const db = await getDb();
    const updatePayload: Record<string, unknown> = {
      ...payload,
      updatedAt: new Date(),
    };

    if (payload.name) {
      updatePayload.slug = createSlug(payload.name);
    }

    await db.collection<CharacterDocument>("characters").updateOne(
      { _id: character._id },
      { $set: updatePayload },
    );

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/characters/[characterId]">,
) {
  try {
    const viewer = await requireViewer();
    const { characterId } = await context.params;
    const character = await getCharacter(characterId);

    if (
      character.ownerClerkUserId !== viewer.clerkUserId &&
      !viewer.user.isAdmin
    ) {
      throw new ApiError(403, "You cannot delete this character.");
    }

    const db = await getDb();
    await db.collection<CharacterDocument>("characters").updateOne(
      { _id: character._id },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
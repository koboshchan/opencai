import { CharacterDocument, ChatDocument } from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { getDefaultEnabledModel, resolveEnabledModel } from "@/lib/providers";
import { startChatSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  context: RouteContext<"/api/characters/[characterId]/chats">,
) {
  try {
    const viewer = await requireViewer();
    const { characterId } = await context.params;
    const payload = startChatSchema.parse(await request.json());
    const db = await getDb();
    const character = await db.collection<CharacterDocument>("characters").findOne({
      _id: parseObjectId(characterId, "characterId"),
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!character) {
      throw new ApiError(404, "Character not found.");
    }

    if (
      character.visibility === "private" &&
      character.ownerClerkUserId !== viewer.clerkUserId &&
      !viewer.user.isAdmin
    ) {
      throw new ApiError(403, "You do not have access to this character.");
    }

    let selectedModelId = null;

    if (payload.modelId) {
      const resolved = await resolveEnabledModel(payload.modelId);
      selectedModelId = resolved.model._id;
    } else {
      const defaultModel = await getDefaultEnabledModel();
      selectedModelId = defaultModel?._id ?? null;
    }

    const now = new Date();
    const chat: ChatDocument = {
      ownerClerkUserId: viewer.clerkUserId,
      characterId: character._id!,
      title: payload.title || `New chat with ${character.name}`,
      selectedModelId,
      archivedAt: null,
      deletedAt: null,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection<ChatDocument>("chats").insertOne(chat);

    if (character.greeting?.trim()) {
      const greetingMessage = {
        chatId: result.insertedId,
        ownerClerkUserId: viewer.clerkUserId,
        role: "assistant" as const,
        content: character.greeting.trim(),
        createdAt: now,
      };
      await db.collection("chatMessages").insertOne(greetingMessage);
    }

    return Response.json(
      {
        chat: {
          id: result.insertedId.toString(),
          title: chat.title,
          characterId: character._id!.toString(),
          selectedModelId: chat.selectedModelId?.toString() ?? null,
          createdAt: chat.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
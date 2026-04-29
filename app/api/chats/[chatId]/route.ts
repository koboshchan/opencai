import { CharacterDocument, ChatDocument, ProviderModelDocument } from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { updateChatSchema } from "@/lib/validators";

async function getOwnedChat(chatId: string, clerkUserId: string) {
  const db = await getDb();
  const chat = await db.collection<ChatDocument>("chats").findOne({
    _id: parseObjectId(chatId, "chatId"),
    ownerClerkUserId: clerkUserId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });

  if (!chat) {
    throw new ApiError(404, "Chat not found.");
  }

  return chat;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/chats/[chatId]">,
) {
  try {
    const viewer = await requireViewer();
    const { chatId } = await context.params;
    const db = await getDb();
    const chat = await getOwnedChat(chatId, viewer.clerkUserId);
    const character = await db.collection<CharacterDocument>("characters").findOne({ _id: chat.characterId });
    const model = chat.selectedModelId
      ? await db
          .collection<ProviderModelDocument>("providerModels")
          .findOne({ _id: chat.selectedModelId })
      : null;

    return Response.json({
      chat: {
        id: chat._id!.toString(),
        title: chat.title,
        characterId: chat.characterId.toString(),
        characterName: character?.name ?? "Unknown character",
        selectedModelId: chat.selectedModelId?.toString() ?? null,
        selectedModelName: model?.displayName ?? null,
        archivedAt: chat.archivedAt?.toISOString() ?? null,
        lastMessageAt: chat.lastMessageAt.toISOString(),
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/chats/[chatId]">,
) {
  try {
    const viewer = await requireViewer();
    const { chatId } = await context.params;
    const chat = await getOwnedChat(chatId, viewer.clerkUserId);
    const payload = updateChatSchema.parse(await request.json());
    const db = await getDb();
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof payload.title === "string") {
      updatePayload.title = payload.title;
    }

    if (typeof payload.archived === "boolean") {
      updatePayload.archivedAt = payload.archived ? new Date() : null;
    }

    if (payload.modelId !== undefined) {
      updatePayload.selectedModelId = payload.modelId
        ? parseObjectId(payload.modelId, "modelId")
        : null;
    }

    await db.collection<ChatDocument>("chats").updateOne(
      { _id: chat._id },
      { $set: updatePayload },
    );

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/chats/[chatId]">,
) {
  try {
    const viewer = await requireViewer();
    const { chatId } = await context.params;
    const chat = await getOwnedChat(chatId, viewer.clerkUserId);
    const db = await getDb();

    await db.collection<ChatDocument>("chats").updateOne(
      { _id: chat._id },
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
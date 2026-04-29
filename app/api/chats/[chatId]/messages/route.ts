import {
  CharacterDocument,
  ChatDocument,
  ChatMessageDocument,
} from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { resolveEnabledModel, streamChatCompletion } from "@/lib/providers";
import { createMessageSchema } from "@/lib/validators";

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
  request: Request,
  context: RouteContext<"/api/chats/[chatId]/messages">,
) {
  try {
    const viewer = await requireViewer();
    const { chatId } = await context.params;
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
    const cursor = url.searchParams.get("cursor");
    const db = await getDb();
    const chat = await getOwnedChat(chatId, viewer.clerkUserId);
    const filter: Record<string, unknown> = {
      chatId: chat._id,
    };

    if (cursor) {
      filter._id = { $lt: parseObjectId(cursor, "cursor") };
    }

    const messages = await db
      .collection<ChatMessageDocument>("chatMessages")
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();
    const ordered = [...messages].reverse();
    const nextCursor = messages.length === limit ? messages[messages.length - 1]._id!.toString() : null;

    return Response.json({
      messages: ordered.map((message) => ({
        id: message._id!.toString(),
        role: message.role,
        content: message.content,
        modelId: message.modelId?.toString() ?? null,
        providerId: message.providerId?.toString() ?? null,
        promptTokens: message.promptTokens ?? null,
        completionTokens: message.completionTokens ?? null,
        finishReason: message.finishReason ?? null,
        createdAt: message.createdAt.toISOString(),
      })),
      nextCursor,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/chats/[chatId]/messages">,
) {
  try {
    const viewer = await requireViewer();
    const { chatId } = await context.params;
    const payload = createMessageSchema.parse(await request.json());
    const db = await getDb();
    const chat = await getOwnedChat(chatId, viewer.clerkUserId);
    const character = await db
      .collection<CharacterDocument>("characters")
      .findOne({ _id: chat.characterId });

    if (!character) {
      throw new ApiError(404, "Character not found for this chat.");
    }

    const resolved = await resolveEnabledModel(
      payload.modelId || chat.selectedModelId?.toString() || "",
    );
    const now = new Date();
    const userMessage: ChatMessageDocument = {
      chatId: chat._id!,
      ownerClerkUserId: viewer.clerkUserId,
      role: "user",
      content: payload.content,
      modelId: resolved.model._id,
      providerId: resolved.provider._id,
      promptTokens: null,
      completionTokens: null,
      finishReason: null,
      createdAt: now,
    };

    await db.collection<ChatMessageDocument>("chatMessages").insertOne(userMessage);
    await db.collection<ChatDocument>("chats").updateOne(
      { _id: chat._id },
      {
        $set: {
          selectedModelId: resolved.model._id,
          updatedAt: now,
          lastMessageAt: now,
        },
      },
    );

    const history = await db
      .collection<ChatMessageDocument>("chatMessages")
      .find({ chatId: chat._id })
      .sort({ createdAt: 1 })
      .toArray();
    const llmMessages = [
      {
        role: "system",
        content: character.systemPrompt,
      },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    return streamChatCompletion({
      actorClerkUserId: viewer.clerkUserId,
      provider: resolved.provider,
      model: resolved.model,
      messages: llmMessages,
      onComplete: async ({
        assistantText,
        promptTokens,
        completionTokens,
        finishReason,
      }) => {
        if (!assistantText.trim()) {
          return;
        }

        const completedAt = new Date();
        await db.collection<ChatMessageDocument>("chatMessages").insertOne({
          chatId: chat._id!,
          ownerClerkUserId: viewer.clerkUserId,
          role: "assistant",
          content: assistantText,
          modelId: resolved.model._id,
          providerId: resolved.provider._id,
          promptTokens,
          completionTokens,
          finishReason,
          createdAt: completedAt,
        });
        await db.collection<ChatDocument>("chats").updateOne(
          { _id: chat._id },
          {
            $set: {
              updatedAt: completedAt,
              lastMessageAt: completedAt,
            },
          },
        );
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
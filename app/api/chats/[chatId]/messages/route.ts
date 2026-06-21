import fs from "fs";
import path from "path";

import { ModelMessage } from "ai";

import {
  CharacterDocument,
  ChatDocument,
  ChatMessageDocument,
} from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { resolveEnabledModel, streamChatCompletion, generateChatSummary } from "@/lib/providers";
import { createMessageSchema } from "@/lib/validators";

let cachedSystemTemplate: string | null = null;

function getSystemTemplate(): string {
  if (!cachedSystemTemplate) {
    const filePath = path.join(process.cwd(), "public", "system.md");
    cachedSystemTemplate = fs.readFileSync(filePath, "utf-8");
  }
  return cachedSystemTemplate;
}

function buildSystemMessage(character: CharacterDocument, userName: string): string {
  const template = getSystemTemplate();
  return template
    .replace(/\{\{name\}\}/g, character.name)
    .replace(/\{\{description\}\}/g, character.systemPrompt)
    .replace(/\{\{title\}\}/g, character.description)
    .replace(/\{\{user\}\}/g, userName);
}

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

import { Db } from "mongodb";

function isContextLengthError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.stack || "").toLowerCase();
  return (
    msg.includes("context_length_exceeded") ||
    msg.includes("context_length") ||
    msg.includes("context length") ||
    msg.includes("max tokens") ||
    msg.includes("context window") ||
    msg.includes("token limit") ||
    msg.includes("maximum context length") ||
    msg.includes("too long") ||
    msg.includes("limit exceeded") ||
    msg.includes("400")
  );
}

async function compressChatHistory(
  db: Db,
  chat: ChatDocument,
  character: CharacterDocument,
  clerkUserId: string,
  resolved: any
): Promise<boolean> {
  const compressedCount = chat.compressedMessageCount || 0;
  const allMessages = await db
    .collection<ChatMessageDocument>("chatMessages")
    .find({ chatId: chat._id })
    .sort({ createdAt: 1 })
    .toArray();

  const uncompressed = allMessages.slice(compressedCount);
  if (uncompressed.length < 2) {
    return false; // Not enough messages to compress
  }

  const countToCompress = Math.floor(uncompressed.length / 2);
  const messagesToCompress = uncompressed.slice(0, countToCompress);

  const textToCompress = messagesToCompress
    .map(m => `${m.role === "user" ? "User" : character.name}: ${m.content}`)
    .join("\n");

  const existingSummariesText = (chat.summaries || [])
    .map((s, idx) => `Summary ${idx + 1}: ${s}`)
    .join("\n");

  const compressionPrompt = `You are a helper summarizing a conversation history to save context window space.
${existingSummariesText ? `Here are the summaries of the conversation so far:\n${existingSummariesText}\n\n` : ""}
Please write a concise but detailed summary of the following new part of the conversation:
---
${textToCompress}
---
Write only the summary. Do not include any meta text.`;

  const summaryText = await generateChatSummary({
    actorClerkUserId: clerkUserId,
    provider: resolved.provider,
    model: resolved.model,
    prompt: compressionPrompt,
  });

  if (!summaryText?.trim()) {
    return false;
  }

  const newSummaries = [...(chat.summaries || []), summaryText.trim()];
  if (newSummaries.length > 10) {
    newSummaries.shift();
  }

  await db.collection("chats").updateOne(
    { _id: chat._id },
    {
      $set: {
        summaries: newSummaries,
        compressedMessageCount: compressedCount + countToCompress,
        updatedAt: new Date(),
      },
    },
  );

  return true;
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
    let chat = await getOwnedChat(chatId, viewer.clerkUserId);
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
    if (payload.content) {
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
    }

    let attempts = 0;
    while (attempts < 3) {
      try {
        const summaries = chat.summaries || [];
        const compressedCount = chat.compressedMessageCount || 0;

        const history = await db
          .collection<ChatMessageDocument>("chatMessages")
          .find({ chatId: chat._id })
          .sort({ createdAt: 1 })
          .toArray();

        const uncompressedMessages = history.slice(compressedCount);

        const llmMessages: ModelMessage[] = [
          {
            role: "system",
            content: buildSystemMessage(character, viewer.user.displayName || "User"),
          },
          ...summaries.map(s => ({
            role: "system" as const,
            content: `[Conversation Summary]: ${s}`,
          })),
          ...uncompressedMessages.map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
          })),
        ];

        return await streamChatCompletion({
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
      } catch (error: any) {
        console.error("FAILED TO GENERATE in POST /api/chats/[chatId]/messages:", error);
        if (isContextLengthError(error)) {
          const success = await compressChatHistory(db, chat, character, viewer.clerkUserId, resolved);
          if (success) {
            attempts++;
            // Reload chat to get the updated summaries and compressedCount
            chat = await getOwnedChat(chatId, viewer.clerkUserId);
            continue;
          }
        }
        throw error;
      }
    }

    throw new ApiError(500, "Failed to generate response after multiple compression attempts.");
  } catch (error) {
    console.error("FAILED TO GENERATE in POST /api/chats/[chatId]/messages (Outer Catch):", error);
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/chats/[chatId]/messages">,
) {
  try {
    const viewer = await requireViewer();
    const { chatId } = await context.params;
    const db = await getDb();
    const chat = await getOwnedChat(chatId, viewer.clerkUserId);

    const lastMessage = await db
      .collection<ChatMessageDocument>("chatMessages")
      .findOne({ chatId: chat._id }, { sort: { createdAt: -1 } });

    const userMsgCount = await db
      .collection<ChatMessageDocument>("chatMessages")
      .countDocuments({ chatId: chat._id, role: "user" });

    if (userMsgCount > 0 && lastMessage && lastMessage.role === "assistant") {
      await db.collection("chatMessages").deleteOne({ _id: lastMessage._id });

      const newLastMessage = await db
        .collection<ChatMessageDocument>("chatMessages")
        .findOne({ chatId: chat._id }, { sort: { createdAt: -1 } });
      const now = newLastMessage ? newLastMessage.createdAt : new Date();

      await db.collection("chats").updateOne(
        { _id: chat._id },
        {
          $set: {
            updatedAt: now,
            lastMessageAt: now,
          },
        },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("FAILED TO DELETE MESSAGE:", error);
    return toErrorResponse(error);
  }
}
import { CharacterDocument, ChatDocument } from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const chats = await db
      .collection<ChatDocument>("chats")
      .find({
        ownerClerkUserId: viewer.clerkUserId,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
      .sort({ updatedAt: -1 })
      .toArray();
    const characterIds = chats.map((chat) => chat.characterId);
    const characters = characterIds.length
      ? await db
          .collection<CharacterDocument>("characters")
          .find({ _id: { $in: characterIds } })
          .toArray()
      : [];
    const characterById = new Map(
      characters.map((character) => [character._id!.toString(), character]),
    );

    return Response.json({
      chats: chats.map((chat) => ({
        id: chat._id!.toString(),
        title: chat.title,
        characterId: chat.characterId.toString(),
        characterName: characterById.get(chat.characterId.toString())?.name ?? "Unknown character",
        selectedModelId: chat.selectedModelId?.toString() ?? null,
        archivedAt: chat.archivedAt?.toISOString() ?? null,
        lastMessageAt: chat.lastMessageAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
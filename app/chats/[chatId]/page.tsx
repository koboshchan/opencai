import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { requireViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import {
  CharacterDocument,
  ChatDocument,
  ChatMessageDocument,
} from "@/lib/types";

import { ChatRoom } from "./chat-room";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const viewer = await requireViewer();
  const { chatId } = await params;
  const db = await getDb();
  const chat = await db.collection<ChatDocument>("chats").findOne({
    _id: parseObjectId(chatId, "chatId"),
    ownerClerkUserId: viewer.clerkUserId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });

  if (!chat) {
    throw new ApiError(404, "Chat not found.");
  }

  const [character, messages] = await Promise.all([
    db.collection<CharacterDocument>("characters").findOne({ _id: chat.characterId }),
    db
      .collection<ChatMessageDocument>("chatMessages")
      .find({ chatId: chat._id! })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div>
          <Link href="/characters" className="text-sm text-cyan-300 transition hover:text-cyan-200">
            Back to characters
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">{chat.title}</h1>
          <p className="mt-2 text-slate-400">Chatting with {character?.name ?? "Unknown character"}</p>
        </div>
        <UserButton />
      </div>
      <ChatRoom
        chatId={chat._id!.toString()}
        characterName={character?.name ?? "Unknown character"}
        initialMessages={messages.map((message) => ({
          id: message._id!.toString(),
          role: message.role,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
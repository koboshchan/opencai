import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnabledModels } from "@/lib/providers";
import { CharacterDocument } from "@/lib/types";

import { CharactersDashboard } from "./characters-dashboard";

export default async function CharactersPage() {
  const viewer = await requireViewer();
  const db = await getDb();
  const characters = await db
    .collection<CharacterDocument>("characters")
    .find({
      $and: [
        {
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        },
        {
          $or: [
            { ownerClerkUserId: viewer.clerkUserId },
            { visibility: "public" },
          ],
        },
      ],
    })
    .sort({ updatedAt: -1 })
    .toArray();
  const models = await getEnabledModels();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">OpenCai</p>
          <h1 className="mt-2 text-3xl font-semibold">Characters</h1>
          <p className="mt-2 text-slate-400">
            Create public or private characters and start chats against enabled models.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {viewer.user.isAdmin ? (
            <Link
              href="/admin/models"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Admin models
            </Link>
          ) : null}
          <UserButton />
        </div>
      </div>
      <CharactersDashboard
        initialCharacters={characters.map((character) => ({
          id: character._id!.toString(),
          name: character.name,
          slug: character.slug,
          description: character.description,
          systemPrompt: character.systemPrompt,
          visibility: character.visibility,
          ownerClerkUserId: character.ownerClerkUserId,
          tags: character.tags,
          updatedAt: character.updatedAt.toISOString(),
          isOwner: character.ownerClerkUserId === viewer.clerkUserId,
        }))}
        viewerClerkUserId={viewer.clerkUserId}
        isAdmin={viewer.user.isAdmin}
        enabledModelCount={models.length}
      />
    </main>
  );
}
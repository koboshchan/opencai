import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnabledModels } from "@/lib/providers";
import { CharacterDocument } from "@/lib/types";

import { ImportCharacterBox } from "./ImportCharacterBox";
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
    <main>
      <header>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>OpenCai</strong>
            <h1>Characters</h1>
            <p>
              Create public or private characters and start chats against enabled models.
            </p>
          </div>
          <div>
            {viewer.user.isAdmin ? (
              <Link href="/admin/models" style={{ marginRight: "15px" }}>
                Admin models
              </Link>
            ) : null}
            <UserButton />
          </div>
        </div>
      </header>
      <hr />
      <ImportCharacterBox />
      <hr />
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
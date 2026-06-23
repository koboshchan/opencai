import { Filter } from "mongodb";

import { CharacterDocument } from "@/lib/types";
import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") || "").trim();
    const db = await getDb();
    const searchFilter: Filter<CharacterDocument> | null = query
      ? {
          $or: [
            { name: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
            { tags: { $elemMatch: { $regex: query, $options: "i" } } },
          ],
        }
      : null;
    const filter: Filter<CharacterDocument> = {
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
        ...(searchFilter ? [searchFilter] : []),
      ],
    };

    const characters = await db
      .collection<CharacterDocument>("characters")
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(25)
      .toArray();

    return Response.json({
      characters: characters.map((character) => ({
        id: character._id!.toString(),
        name: character.name,
        slug: character.slug,
        description: character.description,
        visibility: character.visibility,
        ownerClerkUserId: character.ownerClerkUserId,
        tags: character.tags,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
import { auth, currentUser } from "@clerk/nextjs/server";
import { Collection } from "mongodb";

import { getDb } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { AppStateDocument, UserDocument, ViewerContext } from "@/lib/types";
import { decryptSecret } from "@/lib/crypto";

async function usersCollection() {
  const db = await getDb();
  return db.collection<UserDocument>("users");
}

async function appStateCollection() {
  const db = await getDb();
  return db.collection<AppStateDocument>("appState");
}

async function claimInitialAdmin(clerkUserId: string) {
  const collection = await appStateCollection();
  const result = await collection.findOneAndUpdate(
    { key: "sole-admin" },
    {
      $setOnInsert: {
        key: "sole-admin",
        value: clerkUserId,
        createdAt: new Date(),
      },
    },
    {
      upsert: true,
      returnDocument: "before",
    },
  );

  return !result;
}

async function upsertUserRecord(clerkUserId: string) {
  const existing = await (await usersCollection()).findOne({ clerkUserId });

  if (existing) {
    return existing;
  }

  const clerk = await currentUser();
  const isAdmin = await claimInitialAdmin(clerkUserId);
  const now = new Date();
  const user: UserDocument = {
    clerkUserId,
    email: clerk?.primaryEmailAddress?.emailAddress ?? null,
    displayName:
      clerk?.fullName ??
      clerk?.username ??
      clerk?.firstName ??
      clerk?.primaryEmailAddress?.emailAddress ??
      null,
    imageUrl: clerk?.imageUrl ?? null,
    isAdmin,
    createdAt: now,
    updatedAt: now,
  };

  await (await usersCollection()).insertOne(user);
  return user;
}

async function getUserRecord(collection: Collection<UserDocument>, clerkUserId: string) {
  const user = await collection.findOne({ clerkUserId });

  if (!user) {
    throw new ApiError(404, "User record not found.");
  }

  return user;
}

export async function requireViewer(): Promise<ViewerContext> {
  // Check for Telegram Bot authorization
  try {
    const { headers } = await import("next/headers");
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token) {
        const db = await getDb();
        const doc = await db.collection<AppStateDocument>("appState").findOne({ key: "telegram-bot-secret" });
        let expectedSecret = process.env.TELEGRAM_BOT_SECRET;
        if (doc?.value) {
          try {
            expectedSecret = decryptSecret(doc.value);
          } catch (err) {
            console.error("Failed to decrypt database bot secret:", err);
          }
        }
        if (expectedSecret && token === expectedSecret) {
          const clerkUserId = headersList.get("x-clerk-user-id");
          if (clerkUserId) {
            const user = await db.collection<UserDocument>("users").findOne({ clerkUserId });
            if (user) {
              return {
                clerkUserId: user.clerkUserId,
                user,
              };
            }
          }
        }
      }
    }
  } catch {
    // headers() might throw outside of request context, ignore and fallback
  }

  const session = await auth();

  if (!session.userId) {
    throw new ApiError(401, "Unauthorized.");
  }

  await upsertUserRecord(session.userId);

  const collection = await usersCollection();
  const user = await getUserRecord(collection, session.userId);

  return {
    clerkUserId: session.userId,
    user,
  };
}

export async function requireAdminViewer() {
  const viewer = await requireViewer();

  if (!viewer.user.isAdmin) {
    throw new ApiError(403, "Admin access required.");
  }

  return viewer;
}

export async function syncSignedInUser() {
  const session = await auth();

  if (!session.userId) {
    throw new ApiError(401, "Unauthorized.");
  }

  await upsertUserRecord(session.userId);

  const collection = await usersCollection();
  return getUserRecord(collection, session.userId);
}
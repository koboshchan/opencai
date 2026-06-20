import { requireAdminViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AppStateDocument } from "@/lib/types";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { toErrorResponse } from "@/lib/errors";
import crypto from "crypto";

export async function GET() {
  try {
    await requireAdminViewer();
    const db = await getDb();
    const doc = await db.collection<AppStateDocument>("appState").findOne({ key: "telegram-bot-secret" });
    let secret = process.env.TELEGRAM_BOT_SECRET || "";
    if (doc?.value) {
      try {
        secret = decryptSecret(doc.value);
      } catch (err) {
        console.error("Failed to decrypt bot secret:", err);
      }
    }
    return Response.json({ secret });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST() {
  try {
    await requireAdminViewer();
    const newSecret = crypto.randomBytes(32).toString("hex");
    const encrypted = encryptSecret(newSecret);
    const db = await getDb();
    await db.collection<AppStateDocument>("appState").updateOne(
      { key: "telegram-bot-secret" },
      {
        $set: {
          value: encrypted,
        },
        $setOnInsert: {
          key: "telegram-bot-secret",
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    return Response.json({ secret: newSecret });
  } catch (error) {
    return toErrorResponse(error);
  }
}

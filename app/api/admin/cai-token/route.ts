import { requireAdminViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AppStateDocument } from "@/lib/types";
import { encryptSecret } from "@/lib/crypto";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    await requireAdminViewer();
    const db = await getDb();
    const doc = await db.collection<AppStateDocument>("appState").findOne({ key: "cai-token" });
    return Response.json({ isSet: !!doc?.value });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminViewer();
    const { token } = await req.json();
    if (typeof token !== "string") {
      return Response.json({ error: "Invalid token" }, { status: 400 });
    }
    const encrypted = encryptSecret(token);
    const db = await getDb();
    await db.collection<AppStateDocument>("appState").updateOne(
      { key: "cai-token" },
      {
        $set: {
          value: encrypted,
        },
        $setOnInsert: {
          key: "cai-token",
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

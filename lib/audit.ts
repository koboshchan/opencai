import { getDb } from "@/lib/db";
import { AuditLogDocument } from "@/lib/types";

export async function recordAuditLog(entry: Omit<AuditLogDocument, "_id" | "createdAt">) {
  const db = await getDb();

  await db.collection<AuditLogDocument>("auditLogs").insertOne({
    ...entry,
    createdAt: new Date(),
  });
}
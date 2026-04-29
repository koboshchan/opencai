import { Db, MongoClient, ObjectId, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME || "opencai";

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

declare global {
  var __mongoClientPromise__: Promise<MongoClient> | undefined;
  var __dbSetupPromise__: Promise<void> | undefined;
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const clientPromise = global.__mongoClientPromise__ || client.connect();

if (process.env.NODE_ENV !== "production") {
  global.__mongoClientPromise__ = clientPromise;
}

async function setupDatabase(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ clerkUserId: 1 }, { unique: true }),
    db.collection("characters").createIndex({ ownerClerkUserId: 1, visibility: 1 }),
    db.collection("characters").createIndex({ visibility: 1, deletedAt: 1 }),
    db.collection("characters").createIndex({ name: "text", description: "text", tags: "text" }),
    db.collection("chats").createIndex({ ownerClerkUserId: 1, updatedAt: -1 }),
    db.collection("chats").createIndex({ characterId: 1, ownerClerkUserId: 1 }),
    db.collection("chatMessages").createIndex({ chatId: 1, createdAt: 1 }),
    db.collection("chatMessages").createIndex({ ownerClerkUserId: 1, chatId: 1, createdAt: 1 }),
    db.collection("providers").createIndex({ name: 1 }, { unique: true }),
    db.collection("providerModels").createIndex({ providerId: 1, remoteModelId: 1 }, { unique: true }),
    db.collection("providerModels").createIndex({ isEnabled: 1, updatedAt: -1 }),
    db.collection("auditLogs").createIndex({ actorClerkUserId: 1, createdAt: -1 }),
    db.collection("appState").createIndex({ key: 1 }, { unique: true }),
  ]);
}

export async function getDb() {
  const connectedClient = await clientPromise;
  const db = connectedClient.db(databaseName);

  if (!global.__dbSetupPromise__) {
    global.__dbSetupPromise__ = setupDatabase(db);
  }

  await global.__dbSetupPromise__;
  return db;
}

export function parseObjectId(id: string, label = "id") {
  if (!ObjectId.isValid(id)) {
    throw new Error(`Invalid ${label}.`);
  }

  return new ObjectId(id);
}
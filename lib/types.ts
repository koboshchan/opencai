import { ObjectId } from "mongodb";

export type Visibility = "public" | "private";
export type ChatRole = "system" | "user" | "assistant";

export interface UserDocument {
  _id?: ObjectId;
  clerkUserId: string;
  email: string | null;
  displayName: string | null;
  imageUrl: string | null;
  isAdmin: boolean;
  telegramUserId?: number;
  telegramUsername?: string | null;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterDocument {
  _id?: ObjectId;
  ownerClerkUserId: string;
  name: string;
  slug: string;
  description: string;
  systemPrompt: string;
  visibility: Visibility;
  avatarUrl: string | null;
  greeting?: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ChatDocument {
  _id?: ObjectId;
  ownerClerkUserId: string;
  characterId: ObjectId;
  title: string;
  selectedModelId?: ObjectId | null;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageDocument {
  _id?: ObjectId;
  chatId: ObjectId;
  ownerClerkUserId: string;
  role: ChatRole;
  content: string;
  modelId?: ObjectId | null;
  providerId?: ObjectId | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  finishReason?: string | null;
  createdAt: Date;
}

export interface ProviderDocument {
  _id?: ObjectId;
  name: string;
  baseUrl: string;
  encryptedApiKey: string;
  isActive: boolean;
  createdByClerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderModelDocument {
  _id?: ObjectId;
  providerId: ObjectId;
  remoteModelId: string;
  displayName: string;
  isEnabled: boolean;
  capabilities: string[];
  rawMetadata?: Record<string, unknown>;
  syncedAt: Date;
  updatedAt: Date;
}

export interface AuditLogDocument {
  _id?: ObjectId;
  actorClerkUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AppStateDocument {
  _id?: ObjectId;
  key: string;
  value: string;
  createdAt: Date;
}

export interface ViewerContext {
  clerkUserId: string;
  user: UserDocument;
}
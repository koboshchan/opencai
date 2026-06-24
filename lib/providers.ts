import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ModelMessage, streamText, generateText } from "ai";
import { ObjectId } from "mongodb";

import { recordAuditLog } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ProviderDocument, ProviderModelDocument } from "@/lib/types";

export interface ResolvedModel {
  provider: ProviderDocument & { _id: ObjectId };
  model: ProviderModelDocument & { _id: ObjectId };
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function maskSecret(secret: string) {
  if (secret.length <= 8) {
    return "********";
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export async function getEnabledModels() {
  const db = await getDb();
  const models = await db
    .collection<ProviderModelDocument>("providerModels")
    .find({ isEnabled: true })
    .sort({ updatedAt: -1 })
    .toArray();

  const providerIds = [...new Set(models.map((model) => model.providerId.toString()))].map(
    (id) => new ObjectId(id),
  );
  const providers = providerIds.length
    ? await db
        .collection<ProviderDocument>("providers")
        .find({ _id: { $in: providerIds }, isActive: true })
        .toArray()
    : [];
  const providerById = new Map(providers.map((provider) => [provider._id!.toString(), provider]));

  return models
    .map((model) => {
      const provider = providerById.get(model.providerId.toString());

      if (!provider) {
        return null;
      }

      return {
        id: model._id!.toString(),
        displayName: model.displayName,
        modelName: model.remoteModelId,
        providerName: provider.name,
        capabilities: model.capabilities,
        updatedAt: model.updatedAt.toISOString(),
      };
    })
    .filter((model): model is NonNullable<typeof model> => model !== null);
}

export async function getDefaultEnabledModel() {
  const db = await getDb();
  return db
    .collection<ProviderModelDocument>("providerModels")
    .findOne({ isEnabled: true }, { sort: { updatedAt: -1 } });
}

export async function resolveEnabledModel(modelId: string): Promise<ResolvedModel> {
  const db = await getDb();
  const modelObjectId = parseObjectId(modelId, "modelId");
  const model = await db
    .collection<ProviderModelDocument>("providerModels")
    .findOne({ _id: modelObjectId, isEnabled: true });

  if (!model) {
    throw new ApiError(404, "Enabled model not found.");
  }

  const provider = await db
    .collection<ProviderDocument>("providers")
    .findOne({ _id: model.providerId, isActive: true });

  if (!provider) {
    throw new ApiError(404, "Provider not found or inactive.");
  }

  return {
    provider: provider as ProviderDocument & { _id: ObjectId },
    model: model as ProviderModelDocument & { _id: ObjectId },
  };
}

export async function fetchProviderModels(provider: ProviderDocument & { _id: ObjectId }) {
  const response = await fetch(`${normalizeBaseUrl(provider.baseUrl)}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${decryptSecret(provider.encryptedApiKey)}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, "Provider model sync failed.", {
      provider: provider.name,
      body: text.slice(0, 500),
    });
  }

  const payload = (await response.json()) as {
    data?: Array<{ id: string; [key: string]: unknown }>;
  };

  return (payload.data || []).filter((item): item is { id: string; [key: string]: unknown } => Boolean(item.id));
}

export async function syncProviderModels(provider: ProviderDocument & { _id: ObjectId }) {
  const db = await getDb();
  const models = await fetchProviderModels(provider);
  const now = new Date();

  if (!models.length) {
    return [] as ProviderModelDocument[];
  }

  await Promise.all(
    models.map((model) =>
      db.collection<ProviderModelDocument>("providerModels").updateOne(
        {
          providerId: provider._id,
          remoteModelId: model.id,
        },
        {
          $set: {
            displayName: model.id,
            rawMetadata: model,
            syncedAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            providerId: provider._id,
            remoteModelId: model.id,
            isEnabled: false,
            capabilities: [],
          },
        },
        { upsert: true },
      ),
    ),
  );

  return db
    .collection<ProviderModelDocument>("providerModels")
    .find({ providerId: provider._id })
    .sort({ remoteModelId: 1 })
    .toArray();
}

interface StreamOptions {
  actorClerkUserId: string;
  provider: ProviderDocument & { _id: ObjectId };
  model: ProviderModelDocument & { _id: ObjectId };
  messages: ModelMessage[];
  reasoning?: "none" | "low" | "medium" | "high" | "xhigh";
  onComplete: (result: {
    assistantText: string;
    promptTokens: number | null;
    completionTokens: number | null;
    finishReason: string | null;
  }) => Promise<void>;
}

export async function streamChatCompletion(options: StreamOptions) {
  try {
    const apiKey = decryptSecret(options.provider.encryptedApiKey);
    const aiProvider = createOpenAICompatible({
      name: options.provider.name,
      apiKey,
      baseURL: normalizeBaseUrl(options.provider.baseUrl),
    });

    const result = streamText({
      model: aiProvider(options.model.remoteModelId),
      messages: options.messages,
      providerOptions: options.reasoning ? {
        [options.provider.name]: {
          reasoningEffort: options.reasoning === "high" ? "high" : "low"
        }
      } : undefined,
      onFinish: async ({ text, usage, finishReason }) => {
        const promptTokens = usage.inputTokens ?? null;
        const completionTokens = usage.outputTokens ?? null;

        await options.onComplete({
          assistantText: text,
          promptTokens,
          completionTokens,
          finishReason: finishReason ?? null,
        });

        await recordAuditLog({
          actorClerkUserId: options.actorClerkUserId,
          action: "chat_completion",
          resourceType: "providerModel",
          resourceId: options.model._id.toString(),
          metadata: {
            providerId: options.provider._id.toString(),
            providerName: options.provider.name,
            remoteModelId: options.model.remoteModelId,
            promptTokens,
            completionTokens,
            finishReason,
          },
        });
      },
    });

    return result.toTextStreamResponse({
      headers: {
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("FAILED TO GENERATE:", error);
    throw error;
  }
}

export async function generateChatSummary(options: {
  actorClerkUserId: string;
  provider: ProviderDocument;
  model: ProviderModelDocument;
  prompt: string;
}): Promise<string> {
  try {
    const apiKey = decryptSecret(options.provider.encryptedApiKey);
    const aiProvider = createOpenAICompatible({
      name: options.provider.name,
      apiKey,
      baseURL: normalizeBaseUrl(options.provider.baseUrl),
    });

    const { text } = await generateText({
      model: aiProvider(options.model.remoteModelId),
      prompt: options.prompt,
    });

    return text;
  } catch (error) {
    console.error("FAILED TO GENERATE SUMMARY:", error);
    throw error;
  }
}
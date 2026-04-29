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
  messages: Array<{ role: string; content: string }>;
  onComplete: (result: {
    assistantText: string;
    promptTokens: number | null;
    completionTokens: number | null;
    finishReason: string | null;
  }) => Promise<void>;
}

function splitSseEvents(buffer: string) {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  return {
    events: parts,
    remainder,
  };
}

function extractEventData(event: string) {
  const lines = event.split(/\r?\n/);
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  return data || null;
}

export async function streamChatCompletion(options: StreamOptions) {
  const response = await fetch(
    `${normalizeBaseUrl(options.provider.baseUrl)}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decryptSecret(options.provider.encryptedApiKey)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model.remoteModelId,
        messages: options.messages,
        stream: true,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new ApiError(response.status || 502, "Provider chat completion failed.", {
      provider: options.provider.name,
      body: body.slice(0, 1000),
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let finishReason: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            controller.enqueue(value);
            buffer += decoder.decode(value, { stream: true });

            const { events, remainder } = splitSseEvents(buffer);
            buffer = remainder;

            for (const event of events) {
              const data = extractEventData(event);

              if (!data || data === "[DONE]") {
                continue;
              }

              try {
                const payload = JSON.parse(data) as {
                  choices?: Array<{
                    delta?: { content?: string };
                    finish_reason?: string | null;
                  }>;
                  usage?: {
                    prompt_tokens?: number;
                    completion_tokens?: number;
                  };
                };
                const choice = payload.choices?.[0];

                if (choice?.delta?.content) {
                  assistantText += choice.delta.content;
                }

                if (choice?.finish_reason) {
                  finishReason = choice.finish_reason;
                }

                if (payload.usage) {
                  promptTokens = payload.usage.prompt_tokens ?? promptTokens;
                  completionTokens = payload.usage.completion_tokens ?? completionTokens;
                }
              } catch {
                continue;
              }
            }
          }
        }

        if (buffer.trim()) {
          const data = extractEventData(buffer);

          if (data && data !== "[DONE]") {
            try {
              const payload = JSON.parse(data) as {
                choices?: Array<{
                  delta?: { content?: string };
                  finish_reason?: string | null;
                }>;
                usage?: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                };
              };
              const choice = payload.choices?.[0];

              if (choice?.delta?.content) {
                assistantText += choice.delta.content;
              }

              if (choice?.finish_reason) {
                finishReason = choice.finish_reason;
              }

              if (payload.usage) {
                promptTokens = payload.usage.prompt_tokens ?? promptTokens;
                completionTokens = payload.usage.completion_tokens ?? completionTokens;
              }
            } catch {
              // Ignore malformed trailing event payloads.
            }
          }
        }

        await options.onComplete({
          assistantText,
          promptTokens,
          completionTokens,
          finishReason,
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

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
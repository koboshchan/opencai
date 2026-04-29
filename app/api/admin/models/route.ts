import { ProviderDocument, ProviderModelDocument } from "@/lib/types";
import { requireAdminViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    await requireAdminViewer();
    const db = await getDb();
    const models = await db
      .collection<ProviderModelDocument>("providerModels")
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();
    const providerIds = [...new Set(models.map((model) => model.providerId.toString()))].map(
      (id) => parseObjectId(id, "providerId"),
    );
    const providers = providerIds.length
      ? await db
          .collection<ProviderDocument>("providers")
          .find({ _id: { $in: providerIds } })
          .toArray()
      : [];
    const providerById = new Map(providers.map((provider) => [provider._id!.toString(), provider]));

    return Response.json({
      models: models.map((model) => ({
        id: model._id!.toString(),
        providerId: model.providerId.toString(),
        providerName: providerById.get(model.providerId.toString())?.name ?? "Unknown provider",
        remoteModelId: model.remoteModelId,
        displayName: model.displayName,
        isEnabled: model.isEnabled,
        capabilities: model.capabilities,
        syncedAt: model.syncedAt.toISOString(),
        updatedAt: model.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
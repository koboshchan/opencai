import { ProviderModelDocument } from "@/lib/types";
import { requireAdminViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { providerModelUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/models/[modelId]">,
) {
  try {
    await requireAdminViewer();
    const { modelId } = await context.params;
    const payload = providerModelUpdateSchema.parse(await request.json());
    const db = await getDb();
    const model = await db.collection<ProviderModelDocument>("providerModels").findOne({
      _id: parseObjectId(modelId, "modelId"),
    });

    if (!model) {
      throw new ApiError(404, "Model not found.");
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof payload.isEnabled === "boolean") {
      updatePayload.isEnabled = payload.isEnabled;
      if (payload.isEnabled) {
        // Disable all other models
        await db.collection<ProviderModelDocument>("providerModels").updateMany(
          { _id: { $ne: model._id } },
          { $set: { isEnabled: false, updatedAt: new Date() } },
        );
      }
    }

    if (payload.displayName) {
      updatePayload.displayName = payload.displayName;
    }

    await db.collection<ProviderModelDocument>("providerModels").updateOne(
      { _id: model._id },
      { $set: updatePayload },
    );

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
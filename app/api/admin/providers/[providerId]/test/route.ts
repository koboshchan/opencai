import { ProviderDocument } from "@/lib/types";
import { requireAdminViewer } from "@/lib/auth";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { fetchProviderModels } from "@/lib/providers";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/admin/providers/[providerId]/test">,
) {
  try {
    await requireAdminViewer();
    const { providerId } = await context.params;
    const db = await getDb();
    const provider = await db.collection<ProviderDocument>("providers").findOne({
      _id: parseObjectId(providerId, "providerId"),
    });

    if (!provider) {
      throw new ApiError(404, "Provider not found.");
    }

    const models = await fetchProviderModels(provider as ProviderDocument & { _id: typeof provider._id });

    return Response.json({
      success: true,
      modelCount: models.length,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
import { ProviderDocument } from "@/lib/types";
import { requireAdminViewer } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getDb, parseObjectId } from "@/lib/db";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { providerUpdateSchema } from "@/lib/validators";

async function getProvider(providerId: string) {
  const db = await getDb();
  const provider = await db.collection<ProviderDocument>("providers").findOne({
    _id: parseObjectId(providerId, "providerId"),
  });

  if (!provider) {
    throw new ApiError(404, "Provider not found.");
  }

  return provider;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/providers/[providerId]">,
) {
  try {
    await requireAdminViewer();
    const { providerId } = await context.params;
    const provider = await getProvider(providerId);

    return Response.json({
      provider: {
        id: provider._id!.toString(),
        name: provider.name,
        baseUrl: provider.baseUrl,
        isActive: provider.isActive,
        createdAt: provider.createdAt.toISOString(),
        updatedAt: provider.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/providers/[providerId]">,
) {
  try {
    await requireAdminViewer();
    const { providerId } = await context.params;
    const provider = await getProvider(providerId);
    const payload = providerUpdateSchema.parse(await request.json());
    const db = await getDb();
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (payload.name) {
      updatePayload.name = payload.name;
    }

    if (payload.baseUrl) {
      updatePayload.baseUrl = payload.baseUrl;
    }

    if (typeof payload.isActive === "boolean") {
      updatePayload.isActive = payload.isActive;
    }

    if (payload.apiKey) {
      updatePayload.encryptedApiKey = encryptSecret(payload.apiKey);
    }

    await db.collection<ProviderDocument>("providers").updateOne(
      { _id: provider._id },
      { $set: updatePayload },
    );

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/providers/[providerId]">,
) {
  try {
    await requireAdminViewer();
    const { providerId } = await context.params;
    const provider = await getProvider(providerId);
    const db = await getDb();

    await db.collection("providerModels").deleteMany({ providerId: provider._id });
    await db.collection<ProviderDocument>("providers").deleteOne({ _id: provider._id });

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
import { ProviderDocument } from "@/lib/types";
import { requireAdminViewer } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";
import { providerSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireAdminViewer();
    const db = await getDb();
    const providers = await db
      .collection<ProviderDocument>("providers")
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();

    return Response.json({
      providers: providers.map((provider) => ({
        id: provider._id!.toString(),
        name: provider.name,
        baseUrl: provider.baseUrl,
        isActive: provider.isActive,
        createdAt: provider.createdAt.toISOString(),
        updatedAt: provider.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireAdminViewer();
    const payload = providerSchema.parse(await request.json());
    const db = await getDb();
    const now = new Date();
    const provider: ProviderDocument = {
      name: payload.name,
      baseUrl: payload.baseUrl,
      encryptedApiKey: encryptSecret(payload.apiKey),
      isActive: payload.isActive,
      createdByClerkUserId: viewer.clerkUserId,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection<ProviderDocument>("providers").insertOne(provider);

    return Response.json(
      {
        provider: {
          id: result.insertedId.toString(),
          name: provider.name,
          baseUrl: provider.baseUrl,
          isActive: provider.isActive,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
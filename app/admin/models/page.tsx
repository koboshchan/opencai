import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { requireAdminViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ProviderDocument, ProviderModelDocument } from "@/lib/types";

import { AdminModelsConsole } from "./admin-models-console";

export default async function AdminModelsPage() {
  await requireAdminViewer();
  const db = await getDb();
  const [providers, models] = await Promise.all([
    db.collection<ProviderDocument>("providers").find({}).sort({ updatedAt: -1 }).toArray(),
    db.collection<ProviderModelDocument>("providerModels").find({}).sort({ updatedAt: -1 }).toArray(),
  ]);
  const providerById = new Map(providers.map((provider) => [provider._id!.toString(), provider]));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <Link href="/characters" className="text-sm text-cyan-300 transition hover:text-cyan-200">
            Back to characters
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">Provider and model admin</h1>
          <p className="mt-2 text-slate-400">
            Register OpenAI-compatible providers, test connectivity, sync remote models, and enable only the models you want users to see.
          </p>
        </div>
        <UserButton />
      </div>
      <AdminModelsConsole
        initialProviders={providers.map((provider) => ({
          id: provider._id!.toString(),
          name: provider.name,
          baseUrl: provider.baseUrl,
          isActive: provider.isActive,
          createdAt: provider.createdAt.toISOString(),
          updatedAt: provider.updatedAt.toISOString(),
        }))}
        initialModels={models.map((model) => ({
          id: model._id!.toString(),
          providerId: model.providerId.toString(),
          providerName: providerById.get(model.providerId.toString())?.name ?? "Unknown provider",
          remoteModelId: model.remoteModelId,
          displayName: model.displayName,
          isEnabled: model.isEnabled,
          syncedAt: model.syncedAt.toISOString(),
        }))}
      />
    </main>
  );
}
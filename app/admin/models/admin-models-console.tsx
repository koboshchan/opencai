"use client";

import { FormEvent, useState } from "react";

type ProviderRow = {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModelRow = {
  id: string;
  providerId: string;
  providerName: string;
  remoteModelId: string;
  displayName: string;
  isEnabled: boolean;
  syncedAt: string;
};

interface AdminModelsConsoleProps {
  initialProviders: ProviderRow[];
  initialModels: ModelRow[];
}

export function AdminModelsConsole({
  initialProviders,
  initialModels,
}: AdminModelsConsoleProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [models, setModels] = useState(initialModels);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [caiToken, setCaiToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('caiToken') || '';
    }
    return '';
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reloadModels() {
    const response = await fetch("/api/admin/models", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error?.message || "Failed to load models.");
    }

    setModels(payload.models);
  }

  async function handleCreateProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/providers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          baseUrl,
          apiKey,
          isActive: true,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || "Failed to create provider.");
      }

      setProviders((current) => [
        {
          id: payload.provider.id,
          name: payload.provider.name,
          baseUrl: payload.provider.baseUrl,
          isActive: payload.provider.isActive,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setName("");
      setBaseUrl("");
      setApiKey("");
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Failed to create provider.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestProvider(providerId: string) {
    setError(null);

    const response = await fetch(`/api/admin/providers/${providerId}/test`, {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error?.message || "Provider test failed.");
      return;
    }

    setError(`Connection ok. Provider returned ${payload.modelCount} models.`);
  }

  async function handleSyncProvider(providerId: string) {
    setError(null);

    const response = await fetch(`/api/admin/providers/${providerId}/sync-models`, {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error?.message || "Model sync failed.");
      return;
    }

    await reloadModels();
  }

  async function handleToggleModel(modelId: string, isEnabled: boolean) {
    setError(null);

    const response = await fetch(`/api/admin/models/${modelId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isEnabled }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error?.message || "Failed to update model.");
      return;
    }

    setModels((current) =>
      current.map((model) =>
        model.id === modelId ? { ...model, isEnabled } : model,
      ),
    );
  }

  return (
    <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold">Character AI Token</h2>
        <p className="mt-2 text-sm text-slate-400">
          This token is used only for importing CAI characters and is not related to LLM providers. It is stored locally in your browser.
        </p>
        <input
          value={caiToken}
          onChange={(event) => {
            setCaiToken(event.target.value);
            if (typeof window !== 'undefined') {
              localStorage.setItem('caiToken', event.target.value);
            }
          }}
          placeholder="Paste your CAI token here"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 mb-4"
          autoComplete="off"
        />
      </section>
      <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold">Add provider</h2>
        <p className="mt-2 text-sm text-slate-400">
          Use the provider base URL for an OpenAI-compatible API server. Keys are encrypted and only used on the server.
        </p>
        <form onSubmit={handleCreateProvider} className="mt-6 space-y-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Provider name"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            required
          />
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            required
          />
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Provider API key"
            type="password"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            required
          />
          {error ? <p className="text-sm text-slate-300">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Create provider"}
          </button>
        </form>
        <div className="mt-8 space-y-3">
          {providers.map((provider) => (
            <article
              key={provider.id}
              className="rounded-[1.25rem] border border-white/10 bg-slate-950/60 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{provider.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{provider.baseUrl}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs uppercase tracking-[0.2em] text-cyan-300">
                  {provider.isActive ? "active" : "inactive"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => handleTestProvider(provider.id)}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10"
                >
                  Test connection
                </button>
                <button
                  onClick={() => handleSyncProvider(provider.id)}
                  className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
                >
                  Sync models
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Available models</h2>
        <p className="mt-2 text-sm text-slate-400">
          Sync a provider, then enable only the models you want users to access.
        </p>
        <div className="mt-6 space-y-3">
          {models.map((model) => (
            <label
              key={model.id}
              className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-slate-950/60 p-4"
            >
              <div>
                <p className="font-medium">{model.displayName}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {model.providerName} · {model.remoteModelId}
                </p>
              </div>
              <input
                type="checkbox"
                checked={model.isEnabled}
                onChange={(event) => handleToggleModel(model.id, event.target.checked)}
                className="h-5 w-5 rounded border-white/20 bg-slate-900 text-cyan-400"
              />
            </label>
          ))}
          {!models.length ? (
            <p className="text-sm text-slate-400">No synced models yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
"use client";

import { FormEvent, useEffect, useState } from "react";

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
  const [caiToken, setCaiToken] = useState("");
  const [caiTokenStatus, setCaiTokenStatus] = useState<string>("Checking...");
  const [savingToken, setSavingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkToken() {
      try {
        const res = await fetch("/api/admin/cai-token");
        const data = await res.json();
        if (data.isSet) {
          setCaiTokenStatus("Saved on server");
        } else {
          setCaiTokenStatus("Not configured");
        }
      } catch {
        setCaiTokenStatus("Error checking token");
      }
    }
    checkToken();
  }, []);

  async function handleSaveCaiToken() {
    if (!caiToken.trim()) return;
    setSavingToken(true);
    try {
      const res = await fetch("/api/admin/cai-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: caiToken }),
      });
      if (res.ok) {
        setCaiTokenStatus("Saved on server");
        setCaiToken("");
        alert("Character.AI token saved successfully!");
      } else {
        const data = await res.json();
        alert(data.error?.message || "Failed to save token.");
      }
    } catch {
      alert("Failed to save token.");
    } finally {
      setSavingToken(false);
    }
  }

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
      current.map((model) => {
        if (model.id === modelId) {
          return { ...model, isEnabled };
        }
        if (isEnabled) {
          return { ...model, isEnabled: false };
        }
        return model;
      }),
    );
  }

  return (
    <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
      <div style={{ flex: 1 }}>
        <section style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "20px" }}>
          <h2>Character AI Token</h2>
          <p>
            This token is used for importing CAI characters. It is stored securely on the server and never exposed to regular users.
          </p>
          <p>Current status: <strong>{caiTokenStatus}</strong></p>
          <input
            value={caiToken}
            onChange={(event) => setCaiToken(event.target.value)}
            placeholder="Paste new Character.AI token here"
            type="password"
            autoComplete="off"
          />
          <div style={{ marginTop: "10px" }}>
            <button onClick={handleSaveCaiToken} disabled={savingToken || !caiToken.trim()}>
              {savingToken ? "Saving..." : "Save token"}
            </button>
          </div>
        </section>

        <section style={{ border: "1px solid #ccc", padding: "15px" }}>
          <h2>Add provider</h2>
          <p>
            Use the provider base URL for an OpenAI-compatible API server. Keys are encrypted and only used on the server.
          </p>
          <form onSubmit={handleCreateProvider}>
            <div>
              <label>Name: </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Provider name"
                required
              />
            </div>
            <div style={{ marginTop: "10px" }}>
              <label>Base URL: </label>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
                required
              />
            </div>
            <div style={{ marginTop: "10px" }}>
              <label>API Key: </label>
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Provider API key"
                type="password"
                required
              />
            </div>
            {error ? <p style={{ color: "red" }}>{error}</p> : null}
            <div style={{ marginTop: "15px" }}>
              <button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Create provider"}
              </button>
            </div>
          </form>
          <hr />
          <div style={{ marginTop: "15px" }}>
            {providers.map((provider) => (
              <article
                key={provider.id}
                style={{ border: "1px solid #ddd", padding: "10px", marginBottom: "10px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3>{provider.name}</h3>
                    <p style={{ margin: "5px 0 0 0", fontSize: "0.9em", color: "#666" }}>{provider.baseUrl}</p>
                  </div>
                  <span>[{provider.isActive ? "active" : "inactive"}]</span>
                </div>
                <div style={{ marginTop: "10px" }}>
                  <button onClick={() => handleTestProvider(provider.id)}>
                    Test connection
                  </button>
                  {" "}
                  <button onClick={() => handleSyncProvider(provider.id)}>
                    Sync models
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: "20px" }}>
        <h2>Available models</h2>
        <p>
          Sync a provider, then enable only the models you want users to access.
        </p>
        <div style={{ marginTop: "15px" }}>
          {models.map((model) => (
            <label
              key={model.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #ddd", padding: "10px", marginBottom: "10px" }}
            >
              <div>
                <strong>{model.displayName}</strong>
                <p style={{ margin: "5px 0 0 0", fontSize: "0.85em", color: "#666" }}>
                  {model.providerName} · {model.remoteModelId}
                </p>
              </div>
              <input
                type="radio"
                name="enabledModel"
                checked={model.isEnabled}
                onChange={() => handleToggleModel(model.id, !model.isEnabled)}
              />
            </label>
          ))}
          {!models.length ? (
            <p>No synced models yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
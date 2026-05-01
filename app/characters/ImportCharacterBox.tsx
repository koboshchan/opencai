"use client";
import { useState, FormEvent } from "react";

export function ImportCharacterBox() {
  const [importUrl, setImportUrl] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  async function handleImportCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const caiToken = typeof window !== 'undefined' ? localStorage.getItem('caiToken') : null;
      if (!caiToken) {
        setImportError('Missing CAI token. Set it in the admin console.');
        setImporting(false);
        return;
      }
      const response = await fetch('/api/import-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-characterai-token': caiToken,
        },
        body: JSON.stringify({ url: importUrl, visibility }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === "string"
            ? payload.error
            : payload?.error?.message || 'Failed to import character.';
        throw new Error(errorMessage);
      }
      setImportSuccess('Character imported! Refresh to see it in your list.');
      setImportUrl("");
      setVisibility("private");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Failed to import character.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="mx-auto mb-8 max-w-2xl rounded-[1.5rem] border border-cyan-400/30 bg-cyan-950/20 p-6">
      <h2 className="text-xl font-semibold text-cyan-200">Import Character</h2>
      <p className="mt-2 text-sm text-cyan-100">
        Import a character from Character.AI by URL. Requires your CAI token (set in the admin console).
      </p>
      <form onSubmit={handleImportCharacter} className="mt-4 flex flex-col gap-3">
        <input
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          placeholder="Paste CAI character URL here"
          className="flex-1 rounded-2xl border border-cyan-400/30 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-cyan-400"
          autoComplete="off"
          required
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-slate-950/70 px-4 py-3 text-sm text-cyan-100">
            Visibility
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "private")}
              className="rounded-lg border border-cyan-400/30 bg-slate-900 px-2 py-1 text-white outline-none"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={importing}
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </form>
      {importError ? <p className="mt-2 text-sm text-rose-300">{importError}</p> : null}
      {importSuccess ? <p className="mt-2 text-sm text-green-300">{importSuccess}</p> : null}
    </section>
  );
}
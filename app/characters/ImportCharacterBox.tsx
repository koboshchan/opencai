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
      const response = await fetch('/api/import-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    <section>
      <h2>Import Character</h2>
      <p>
        Import a character from Character.AI by URL.
      </p>
      <form onSubmit={handleImportCharacter}>
        <div>
          <input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="Paste CAI character URL here"
            autoComplete="off"
            required
          />
        </div>
        <div style={{ marginTop: "10px" }}>
          <label>
            Visibility:{" "}
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "private")}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>
          {" "}
          <button type="submit" disabled={importing}>
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </form>
      {importError ? <p style={{ color: "red" }}>{importError}</p> : null}
      {importSuccess ? <p style={{ color: "green" }}>{importSuccess}</p> : null}
    </section>
  );
}
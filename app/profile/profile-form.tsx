"use client";

import { FormEvent, useState } from "react";

type InitialUser = {
  displayName: string;
  description: string;
  email: string | null;
};

interface ProfileFormProps {
  initialUser: InitialUser;
}

export function ProfileForm({ initialUser }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialUser.displayName);
  const [description, setDescription] = useState(initialUser.description);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          description: description.trim(),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || "Failed to update profile.");
      }

      setDisplayName(payload.user.displayName ?? "");
      setDescription(payload.user.description ?? "");
      setSaved(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "480px" }}>
      <div>
        <label>Email: </label>
        <p style={{ margin: "4px 0", color: "#666" }}>{initialUser.email || "Not set"}</p>
      </div>
      <div style={{ marginTop: "15px" }}>
        <label>Display name: </label>
        <input
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setSaved(false);
          }}
          placeholder="Name characters will call you"
          minLength={2}
          maxLength={80}
          required
        />
      </div>
      <div style={{ marginTop: "15px" }}>
        <label>Bio: </label>
        <textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setSaved(false);
          }}
          placeholder="A short description characters use as context about you"
          maxLength={500}
          rows={4}
        />
        <p style={{ margin: "4px 0", fontSize: "0.85em", color: "#666" }}>{description.length}/500</p>
      </div>
      {error ? <p style={{ color: "red" }}>{error}</p> : null}
      {saved ? <p style={{ color: "green" }}>Saved.</p> : null}
      <div style={{ marginTop: "15px" }}>
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}

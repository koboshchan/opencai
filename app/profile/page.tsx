import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { requireViewer } from "@/lib/auth";

import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const viewer = await requireViewer();

  return (
    <main>
      <header>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p>
              <Link href="/characters">Back to characters</Link>
            </p>
            <h1>Your profile</h1>
            <p>Update the name and bio characters see when they talk to you.</p>
          </div>
          <UserButton />
        </div>
      </header>
      <hr />
      <ProfileForm
        initialUser={{
          displayName: viewer.user.displayName ?? "",
          description: viewer.user.description ?? "",
          email: viewer.user.email,
        }}
      />
    </main>
  );
}

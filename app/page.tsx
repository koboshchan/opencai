import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/characters");
  }
  return (
    <main>
      <h1>OpenCai</h1>
      <p>
        <Link href="/sign-up">Create account</Link>
        {" | "}
        <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}

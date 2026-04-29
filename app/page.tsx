import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/characters");
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-8 p-8 rounded-2xl border border-white/10 bg-white/5 shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">OpenCai</h1>
        <div className="flex gap-4">
          <Link
            href="/sign-up"
            className="rounded-full bg-cyan-400 px-6 py-3 font-medium text-slate-950 transition hover:bg-cyan-300"
          >
            Create account
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

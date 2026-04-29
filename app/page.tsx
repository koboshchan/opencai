import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/characters");
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_#1e293b,_#020617_60%)] px-6 py-16 text-white">
      <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-2xl shadow-slate-950/50 backdrop-blur md:p-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_0.9fr] md:items-end">
          <section className="space-y-6">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">
              OpenCAI
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance md:text-6xl">
              Private or public AI characters, backed by your own model registry.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Users create characters, choose from admin-enabled models, and chat through a server-side proxy that keeps provider secrets out of the browser.
            </p>
            <div className="flex flex-wrap gap-4">
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
          </section>
          <section className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-6 text-sm text-slate-300">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-slate-400">
              Included
            </p>
            <ul className="space-y-3">
              <li>Clerk-authenticated route handlers</li>
              <li>Mongo-backed characters, chats, and messages</li>
              <li>Admin-managed OpenAI-compatible providers</li>
              <li>Server-side streaming proxy for chat completions</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-ink-700/10 bg-white/90 p-10 shadow-card">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          Welcome back
        </h1>
        <p className="mt-3 text-sm text-ink-500">
          Sign in to access your reconciliation workspace.
        </p>
        <button
          className="mt-8 w-full rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink-700"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          Continue with Google
        </button>
        <Link className="mt-6 block text-center text-xs text-ink-500" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}

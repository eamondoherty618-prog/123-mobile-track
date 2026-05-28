"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";

import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const ok = login(username, password);
    if (ok) {
      router.replace("/dashboard");
    } else {
      setError("Incorrect username or password.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cloud px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-brand-navy">
            <span className="text-lg font-bold text-white">123</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-ink">123 Mobile Track</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-brand-line bg-white p-6 shadow-panel"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                Username
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@123mobile"
                  className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud pl-9 pr-4 text-sm outline-none transition focus:border-brand-forest focus:ring-1 focus:ring-brand-forest"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud pl-9 pr-4 text-sm outline-none transition focus:border-brand-forest focus:ring-1 focus:ring-brand-forest"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-md bg-brand-navy text-sm font-semibold text-white transition hover:bg-brand-forest disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          123 Mobile Track · Fleet Management
        </p>
      </div>
    </div>
  );
}

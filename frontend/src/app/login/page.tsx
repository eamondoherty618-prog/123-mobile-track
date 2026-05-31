"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";

import { useAuth } from "@/lib/auth";

type Mode = "signin" | "signup" | "forgot";

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  return decoded.startsWith("/") ? decoded : null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const { login, signup, forgotPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function reset(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "signin") {
        await login(email, password);
        router.replace(next ?? "/dashboard");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { confirmEmail } = await signup(email, password, name);
        if (confirmEmail) {
          const msg = next
            ? "Account created! Check your email to confirm, then sign back in to continue linking your tracker."
            : "Account created! Check your email to confirm before signing in.";
          setSuccess(msg);
          setMode("signin");
        } else {
          router.replace(next ?? "/onboarding");
        }
      } else if (mode === "forgot") {
        await forgotPassword(email);
        setSuccess("Password reset email sent. Check your inbox.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-brand-cloud px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-24 w-24 overflow-hidden rounded-full drop-shadow-md">
          <img src="/123-mobile-track-logo.png" alt="123 Mobile Track" className="h-full w-full object-contain scale-[1.5]" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-ink">123 Mobile Track</h1>
          <p className="mt-0.5 text-sm text-slate-500">Fleet management, simplified.</p>
        </div>
      </div>

      <div className="w-full max-w-sm">
        {mode !== "forgot" && (
          <div className="mb-4 flex rounded-xl border border-brand-line bg-white p-1 shadow-sm">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => reset(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  mode === m ? "bg-brand-navy text-white shadow-sm" : "text-slate-500 hover:text-brand-ink"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-xl border border-brand-line bg-white p-6 shadow-panel">
          <div className="space-y-4">
            {mode === "forgot" && (
              <div className="pb-1">
                <h2 className="text-base font-semibold text-brand-ink">Reset your password</h2>
                <p className="mt-1 text-sm text-slate-500">Enter your email and we&apos;ll send a reset link.</p>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink">Full name</label>
                <div className="relative">
                  <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud pl-9 pr-4 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">Email</label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud pl-9 pr-4 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-brand-ink">Password</label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => reset("forgot")} className="text-xs text-brand-navy hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                    required
                    className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud pl-9 pr-10 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>}
            {success && <p className="rounded-md bg-green-50 px-3 py-2.5 text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-md bg-brand-navy text-sm font-semibold text-white transition hover:bg-brand-forest disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>

            {mode === "forgot" && (
              <button type="button" onClick={() => reset("signin")} className="w-full text-center text-sm text-brand-navy hover:underline">
                Back to sign in
              </button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          By signing up you agree to our{" "}
          <a href="/privacy" className="underline hover:text-slate-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

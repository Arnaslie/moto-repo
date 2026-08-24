"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuthForm({
  mode,
  next = null,
}: {
  mode: "signup" | "login";
  /** Where they were headed before the door. Already validated by the page
   *  that rendered this — see safeNextPath in lib/auth. */
  next?: string | null;
}) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const switchHref = (to: "/login" | "/signup") =>
    next ? `${to}?next=${encodeURIComponent(next)}` : to;

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const body = isSignup
        ? { displayName, handle, email, password }
        : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      router.refresh();
      // Somewhere to get back to beats the default landing — a rider who
      // signed up to get into a room wants the room, not their empty profile.
      router.push(next ?? (isSignup ? `/profile/${data.user.handle}` : "/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-6 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <span aria-hidden>🏍️</span>
        moto<span className="text-orange-500">repo</span>
      </Link>
      <h1 className="mb-1 text-xl font-bold">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mb-6 text-sm text-black/50 dark:text-white/50">
        {isSignup ? "Join the ride and build your rider." : "Log in to keep riding."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignup && (
          <>
            <Field
              label="Display name (optional)"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Trailblazer Tom"
              maxLength={50}
            />
            <Field
              label="Handle"
              value={handle}
              onChange={(v) => setHandle(v.toLowerCase())}
              placeholder="trailblazer_tom"
              autoComplete="username"
              required
            />
          </>
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
        />

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {submitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-black/50 dark:text-white/50">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href={switchHref("/login")} className="font-medium text-orange-500">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={switchHref("/signup")} className="font-medium text-orange-500">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-black/70 dark:text-white/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/20"
      />
    </label>
  );
}

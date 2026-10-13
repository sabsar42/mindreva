"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, Input, toast } from "@mindreva/ui";
import { createClient } from "@mindreva/auth/client";
import { GoogleIcon } from "./google-icon";

type Mode = "sign-in" | "sign-up";

const copy = {
  "sign-in": {
    title: "Sign in to Mindreva",
    subtitle: "Welcome back! Please sign in to continue",
    submit: "Continue",
    switchText: "Don't have an account?",
    switchHref: "/sign-up",
    switchLabel: "Sign up",
  },
  "sign-up": {
    title: "Create your account",
    subtitle: "A few seconds and your first note is a tap away",
    submit: "Create account",
    switchText: "Already have an account?",
    switchHref: "/sign-in",
    switchLabel: "Sign in",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/journal";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const c = copy[mode];

  async function handleGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
          redirectTo,
        )}`,
      },
    });
    if (error) toast.error(error.message);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const supabase = createClient();
    try {
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
        router.push("/onboarding/languages");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
      }
      // No router.refresh() here: both branches navigate to a different
      // route, which already renders with the new session cookies. A refresh
      // queued behind the push re-rendered the destination a second time
      // and emptied the Router Cache right after AppShell's tab prefetches.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="text-foreground text-balance text-4xl font-bold leading-[1.1] tracking-tight">
          {c.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-balance text-base leading-relaxed">
          {c.subtitle}
        </p>
      </div>

      <Button
        type="button"
        variant="ink"
        size="lg"
        className="mt-8 w-full"
        onClick={handleGoogle}
      >
        <GoogleIcon className="size-5" />
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-foreground text-sm font-semibold"
          >
            Email address
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-foreground text-sm font-semibold"
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="pr-11"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Please wait…" : c.submit}
        </Button>
      </form>

      <p className="text-muted-foreground mt-5 text-center text-sm">
        {c.switchText}{" "}
        <Link
          href={c.switchHref}
          className="text-primary font-semibold hover:underline"
        >
          {c.switchLabel}
        </Link>
      </p>
    </div>
  );
}

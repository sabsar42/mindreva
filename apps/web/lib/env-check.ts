/**
 * Startup check of the environment, run once per server process from
 * instrumentation.ts. Two levels:
 *
 * - REQUIRED: without these nothing works (no database, no sign-in). In
 *   production a missing one stops the server with a message naming it, which
 *   is far clearer than every page failing in its own way. In development it
 *   is logged.
 * - Provider and optional settings: logged as warnings naming the variable
 *   and what stops working, because the app degrades rather than breaks
 *   without them (fallbacks, hidden features).
 *
 * Values are never printed, only names.
 */

import { getGoogleCalendarConfig } from "./integrations/google/config";

const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const has = (name: string) => Boolean(process.env[name]?.trim());

export interface EnvReport {
  missingRequired: string[];
  warnings: string[];
}

export function checkEnv(): EnvReport {
  const missingRequired = REQUIRED.filter((n) => !has(n));
  const warnings: string[] = [];
  const need = (name: string, why: string) => {
    if (!has(name)) warnings.push(`${name} is not set: ${why}`);
  };

  const llm = process.env.LLM_PROVIDER ?? "gemini";
  if (llm === "openrouter") {
    need(
      "OPENROUTER_API_KEY",
      "summaries, chat and search can't use OpenRouter.",
    );
    need("OPENROUTER_MODEL", "OpenRouter completions have no primary model.");
    need(
      "OPENROUTER_EMBEDDING_MODEL",
      "entries can't be embedded, so chat search falls back to keywords.",
    );
  } else if (llm === "groq") {
    need("GROQ_API_KEY", "completions have no provider.");
  } else if (llm === "claude") {
    need("ANTHROPIC_API_KEY", "completions have no provider.");
  } else {
    need("GEMINI_API_KEY", "completions and embeddings have no provider.");
  }

  const asr = process.env.ASR_PROVIDER ?? "groq";
  if (asr === "groq")
    need("GROQ_API_KEY", "voice recordings can't be transcribed.");
  if (asr === "huggingface")
    need("HUGGINGFACE_API_KEY", "voice recordings can't be transcribed.");

  need(
    "SUPABASE_SERVICE_ROLE_KEY",
    "account deletion and pictures on shared entries don't work.",
  );
  need(
    "CRON_SECRET",
    "the daily embedding catch-up job refuses to run (page loads still catch up).",
  );

  // Google Calendar is all-or-nothing: warn only when it's half set up.
  const calendarVars = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "CALENDAR_TOKEN_KEY",
  ];
  const calendarSet = calendarVars.filter(has);
  if (calendarSet.length > 0 && calendarSet.length < calendarVars.length) {
    warnings.push(
      `Google Calendar is partly configured (missing ${calendarVars
        .filter((v) => !has(v))
        .join(", ")}), so it stays off.`,
    );
  } else if (
    calendarSet.length === calendarVars.length &&
    !getGoogleCalendarConfig()
  ) {
    warnings.push(
      "Google Calendar settings are invalid (CALENDAR_TOKEN_KEY must be 32 bytes base64; GOOGLE_REDIRECT_URI must be https), so it stays off.",
    );
  }

  const support = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  if (support && !support.startsWith("https://")) {
    warnings.push(
      "NEXT_PUBLIC_SUPPORT_URL is not an https:// URL, so the support link is hidden.",
    );
  }
  if (process.env.VERCEL_ENV === "production" && !has("NEXT_PUBLIC_SITE_URL")) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL is not set: share previews and the sitemap use the Vercel production URL instead of a custom domain.",
    );
  }
  return { missingRequired, warnings };
}

/** Logs the report; throws in production when a required variable is missing. */
export function enforceEnv(): void {
  const { missingRequired, warnings } = checkEnv();
  for (const w of warnings) console.warn(`[env] ${w}`);
  if (missingRequired.length === 0) return;
  const message = `[env] Missing required environment variable(s): ${missingRequired.join(", ")}. Set them (see .env.example) and redeploy.`;
  if (process.env.NODE_ENV === "production") throw new Error(message);
  console.error(message);
}

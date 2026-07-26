# Known Issues

Open, unresolved items. Not decisions already made (see
[docs/DECISIONS.md](./DECISIONS.md) for those) — this is specifically for
things still outstanding.

---

## Gemini API returns 403 PERMISSION_DENIED at the account level

**Status:** Open. Not resolved — worked around, not fixed.

**What's wrong:** `GEMINI_API_KEY` requests fail with
`403 PERMISSION_DENIED: "Your project has been denied access. Please contact
support."` This was reproduced across multiple distinct Google Cloud
projects (a fresh key under a brand-new project hit the same wall), and a
separate attempt returned `429 RESOURCE_EXHAUSTED` with
`quota_limit_value: "0"` for every project tried in the `asia-southeast1`
region — consistent with a restriction on the Google account itself, not a
per-project misconfiguration or a bug in `GeminiLLMProvider`
(`packages/llm/src/providers/gemini-provider.ts`, confirmed to make a
correct, well-formed request).

**Current workaround:** `OpenRouterLLMProvider` is the standing default
(`LLM_PROVIDER=openrouter`). See
[docs/DECISIONS.md](./DECISIONS.md#2026-07-26--switched-default-llm-provider-from-gemini-to-openrouter)
for the full decision record. `GeminiLLMProvider` itself is untouched and
ready to go the moment this is resolved — reverting is a one-line env var
change (`LLM_PROVIDER=gemini`), not a code change.

**To revisit when there's time to chase it:**

- Try a completely fresh Google account (not just a new Cloud project under
  the same account) — the failure pattern points at the account, not the
  project.
- Or contact Google Cloud support directly, per the error message's own
  suggestion.

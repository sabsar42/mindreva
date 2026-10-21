import "server-only";
import { cache } from "react";
import { ProfilesRepository, type Profile } from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";
import { dayKeyInZone } from "../day-key";

/**
 * Business logic for the current user's profile. Route handlers / server
 * actions call this; it resolves the authenticated user and delegates data
 * access to the repository. Never touches Drizzle directly.
 */

export const USE_CASES = [
  "general",
  "meetings",
  "interviews",
  "lectures",
  "personal",
] as const;
export type UseCase = (typeof USE_CASES)[number];

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/**
 * Request-scoped via React's cache(): the protected layout (for the avatar
 * menu) and the page itself both read the profile in one render, so it costs
 * one query, not two.
 */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const userId = await requireUserId();
  return ProfilesRepository.getById(userId);
});

/** The user's own calendar day ("YYYY-MM-DD"), cut at their midnight. */
export async function getMyToday(): Promise<string> {
  const profile = await getMyProfile();
  return dayKeyInZone(profile?.timezone);
}

/** Save the onboarding language + use-case selections. */
export async function saveOnboarding(input: {
  languages: string[];
  summaryStyle: UseCase;
}): Promise<Profile | null> {
  const userId = await requireUserId();
  const languages = input.languages.length ? input.languages.join(",") : "en"; // English default so onboarding is always skippable
  const summaryStyle = USE_CASES.includes(input.summaryStyle)
    ? input.summaryStyle
    : "general";
  return ProfilesRepository.update(userId, { languages, summaryStyle });
}

export async function updateProfile(patch: {
  displayName?: string;
  languages?: string[];
  summaryStyle?: UseCase;
}): Promise<Profile | null> {
  const userId = await requireUserId();
  return ProfilesRepository.update(userId, {
    ...(patch.displayName !== undefined && { displayName: patch.displayName }),
    ...(patch.languages !== undefined && {
      languages: patch.languages.join(","),
    }),
    ...(patch.summaryStyle !== undefined && {
      summaryStyle: patch.summaryStyle,
    }),
  });
}

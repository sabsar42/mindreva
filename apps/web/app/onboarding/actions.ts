"use server";

import { redirect } from "next/navigation";
import {
  saveOnboarding,
  updateProfile,
  type UseCase,
} from "@/lib/services/profile.service";

export async function saveLanguagesAction(languages: string[]) {
  // Persist languages now (with an English fallback) and move to the next step.
  await saveOnboarding({ languages, summaryStyle: "general" });
  redirect("/onboarding/use-case");
}

export async function saveUseCaseAction(summaryStyle: UseCase) {
  // Only the summary style here — languages were saved in the previous step.
  await updateProfile({ summaryStyle });
  redirect("/journal");
}

export async function skipOnboardingAction() {
  await saveOnboarding({ languages: ["en"], summaryStyle: "general" });
  redirect("/journal");
}

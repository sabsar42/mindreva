"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@mindreva/auth/server";
import { updateProfile, type UseCase } from "@/lib/services/profile.service";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function updateSummaryStyleAction(summaryStyle: UseCase) {
  await updateProfile({ summaryStyle });
  revalidatePath("/account");
}

export async function updateLanguagesAction(languages: string[]) {
  await updateProfile({ languages: languages.length ? languages : ["en"] });
  revalidatePath("/account");
}

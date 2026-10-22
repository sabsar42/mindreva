"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@mindreva/auth/server";
import { updateProfile, type UseCase } from "@/lib/services/profile.service";
import { deleteMyAccount } from "@/lib/services/account.service";

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

/** The word the user types to confirm, so a stray tap can't erase anything. */
const DELETE_CONFIRMATION = "delete";

export async function deleteAccountAction(
  confirmation: string,
): Promise<{ error: string } | never> {
  if (confirmation.trim().toLowerCase() !== DELETE_CONFIRMATION) {
    return { error: `Type "${DELETE_CONFIRMATION}" to confirm.` };
  }
  try {
    await deleteMyAccount();
  } catch (err) {
    console.error("Account deletion failed:", err);
    return {
      error:
        "We couldn't finish deleting your account. Nothing more was removed than before; please try again.",
    };
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in?deleted=1");
}

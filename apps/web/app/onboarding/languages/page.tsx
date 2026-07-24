import { getMyProfile } from "@/lib/services/profile.service";
import { LanguagesForm } from "./languages-form";

export default async function LanguagesPage() {
  const profile = await getMyProfile();
  const initial = profile?.languages
    ? profile.languages.split(",").filter(Boolean)
    : [];
  return <LanguagesForm initial={initial} />;
}

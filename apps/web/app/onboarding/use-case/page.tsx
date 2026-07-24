import { getMyProfile, type UseCase } from "@/lib/services/profile.service";
import { UseCaseForm } from "./use-case-form";

export default async function UseCasePage() {
  const profile = await getMyProfile();
  const initial = (profile?.summaryStyle as UseCase) ?? "general";
  return <UseCaseForm initial={initial} />;
}

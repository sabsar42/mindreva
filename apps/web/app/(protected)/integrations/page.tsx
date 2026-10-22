import { listMyIntegrations } from "@/lib/services/integrations.service";
import { IntegrationsScreen } from "./integrations-screen";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const [integrations, { result }] = await Promise.all([
    listMyIntegrations(),
    searchParams,
  ]);
  return <IntegrationsScreen initial={integrations} result={result} />;
}

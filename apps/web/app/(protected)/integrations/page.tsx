import { listMyIntegrations } from "@/lib/services/integrations.service";
import { IntegrationsScreen } from "./integrations-screen";

export default async function IntegrationsPage() {
  const integrations = await listMyIntegrations();
  return <IntegrationsScreen initial={integrations} />;
}

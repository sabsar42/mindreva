import "server-only";
import { getUser } from "@mindreva/auth/server";
import { getProvider, listProviders } from "@/lib/integrations/registry";
import type { ConnectResult, IntegrationView } from "@/lib/integrations/types";

/**
 * Business logic for the current user's integrations. Routes call this; it
 * resolves the authenticated user and delegates to the provider for the
 * integration in question. It never names a specific vendor.
 */

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function listMyIntegrations(): Promise<IntegrationView[]> {
  const userId = await requireUserId();
  return Promise.all(
    listProviders().map(async (provider) => ({
      ...provider.definition,
      connection: await provider.getConnection(userId),
      available: provider.isConfigured(),
    })),
  );
}

/** Throws IntegrationNotFoundError / IntegrationNotConfiguredError; routes map them to statuses. */
export async function connectMyIntegration(id: string): Promise<ConnectResult> {
  const userId = await requireUserId();
  return getProvider(id).connect(userId);
}

export async function disconnectMyIntegration(id: string): Promise<void> {
  const userId = await requireUserId();
  await getProvider(id).disconnect(userId);
}

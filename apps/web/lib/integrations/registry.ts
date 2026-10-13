import type { IntegrationProvider } from "./provider";
import { IntegrationNotFoundError } from "./types";
import { googleCalendarProvider } from "./providers/google-calendar";

/** Every integration Mindreva knows about, in the order the UI lists them. */
const PROVIDERS: IntegrationProvider[] = [googleCalendarProvider];

export function listProviders(): IntegrationProvider[] {
  return PROVIDERS;
}

export function getProvider(id: string): IntegrationProvider {
  const provider = PROVIDERS.find((p) => p.definition.id === id);
  if (!provider) throw new IntegrationNotFoundError(id);
  return provider;
}

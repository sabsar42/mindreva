import type {
  ConnectResult,
  IntegrationConnection,
  IntegrationDefinition,
} from "./types";

/**
 * What every integration implements. Business logic and routes talk to this
 * interface only, never to a specific vendor, the same rule as ASRProvider and
 * LLMProvider. Adding an integration means adding one file under providers/
 * and one line in registry.ts.
 */
export interface IntegrationProvider {
  readonly definition: IntegrationDefinition;
  /** True once this deployment has whatever the integration needs (credentials, etc.). */
  isConfigured(): boolean;
  getConnection(userId: string): Promise<IntegrationConnection>;
  /** Begin connecting. Throws IntegrationNotConfiguredError if !isConfigured(). */
  connect(userId: string): Promise<ConnectResult>;
  /** Finish connecting from the provider's redirect (OAuth callback). */
  handleCallback?(params: URLSearchParams): Promise<void>;
  /** Revoke at the provider and delete stored credentials. */
  disconnect(userId: string): Promise<void>;
}

/**
 * Integration contracts. Pure types and two error classes, with no server-only
 * imports, so the Integrations screen (a client component) can share them with
 * the server code that fills them in.
 */

export type IntegrationId = "google-calendar";

/** Static description of an integration: what the UI shows before anything is connected. */
export interface IntegrationDefinition {
  id: IntegrationId;
  name: string;
  description: string;
}

/** The current user's connection to one integration. */
export interface IntegrationConnection {
  /** needs_reconnect: access was revoked or expired at the provider. */
  status: "connected" | "disconnected" | "needs_reconnect";
  /** Who/what it's connected as (e.g. a Google account email). Null when disconnected. */
  accountLabel: string | null;
  /** ISO timestamp of when the connection was made. Null when disconnected. */
  connectedAt: string | null;
}

/** What the Integrations screen renders: definition + this user's connection + availability. */
export interface IntegrationView extends IntegrationDefinition {
  connection: IntegrationConnection;
  /**
   * Whether this deployment can actually connect it yet. False means the UI
   * shows "Coming soon" and a connect attempt is answered with a clear message
   * rather than a broken flow.
   */
  available: boolean;
}

/** Where to send the user to continue connecting (e.g. an OAuth consent URL). */
export interface ConnectResult {
  redirectUrl: string;
}

export class IntegrationNotFoundError extends Error {
  constructor(id: string) {
    super(`Unknown integration: ${id}`);
    this.name = "IntegrationNotFoundError";
  }
}

export class IntegrationNotConfiguredError extends Error {
  constructor(id: string) {
    super(`The ${id} integration isn't set up on this deployment yet.`);
    this.name = "IntegrationNotConfiguredError";
  }
}

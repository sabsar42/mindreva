import type { IntegrationProvider } from "../provider";
import { IntegrationNotConfiguredError } from "../types";

/**
 * Google Calendar: a placeholder provider, deliberately inert.
 *
 * No OAuth flow, token storage or sync behaviour exists yet, because the
 * requirements for them haven't been specified (which scopes, what gets
 * written to the calendar, one-way or two-way). When they arrive, this file is
 * the only place that changes: implement the four methods, add a table for the
 * connection (with RLS) and flip isConfigured(). The registry, service, API
 * routes and UI are already shaped around this interface.
 */
export const googleCalendarProvider: IntegrationProvider = {
  definition: {
    id: "google-calendar",
    name: "Google Calendar",
    description:
      "Add dates and deadlines from your entries to your Google Calendar.",
  },

  isConfigured: () => false,

  getConnection: async () => ({
    status: "disconnected",
    accountLabel: null,
    connectedAt: null,
  }),

  connect: async () => {
    throw new IntegrationNotConfiguredError("google-calendar");
  },

  disconnect: async () => {
    // Nothing to disconnect until a connection can exist.
  },
};

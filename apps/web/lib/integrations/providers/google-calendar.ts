import "server-only";
import type { IntegrationProvider } from "../provider";
import { IntegrationNotConfiguredError } from "../types";
import {
  completeCalendarConnect,
  disconnectCalendarForUser,
  getCalendarStatusForUser,
  isCalendarConfigured,
  startCalendarConnect,
} from "@/lib/services/calendar.service";

/**
 * Google Calendar: shows your events beside your entries (on an entry's day,
 * on Home and on Re-live Me), and adds an event from an entry only when you tap
 * "Add to calendar". Existing events are never changed and no calendar data is
 * sent to an AI model. Off unless GOOGLE_CLIENT_ID,
 * GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and CALENDAR_TOKEN_KEY are set.
 */
export const googleCalendarProvider: IntegrationProvider = {
  definition: {
    id: "google-calendar",
    name: "Google Calendar",
    description:
      "See the day's events beside your entries and memories, and add events from your recordings with one tap.",
  },

  isConfigured: () => isCalendarConfigured(),

  getConnection: async (userId) => {
    const { status, email, connectedAt } =
      await getCalendarStatusForUser(userId);
    return { status, accountLabel: email, connectedAt };
  },

  connect: async () => {
    if (!isCalendarConfigured()) {
      throw new IntegrationNotConfiguredError("google-calendar");
    }
    return { redirectUrl: await startCalendarConnect() };
  },

  handleCallback: (params) => completeCalendarConnect(params),

  disconnect: (userId) => disconnectCalendarForUser(userId),
};

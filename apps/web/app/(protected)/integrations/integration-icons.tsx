import * as React from "react";
import type { IntegrationId } from "@/lib/integrations/types";

/**
 * A simple calendar glyph in Google Calendar's blue, drawn here rather than
 * copied from Google's asset kit. Each future integration adds its own icon to
 * INTEGRATION_ICONS; the card looks icons up by id and never imports a vendor.
 */
function GoogleCalendarIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#4285F4" />
      <rect x="6" y="8" width="12" height="10" rx="1.5" fill="#fff" />
      <rect x="6" y="3" width="12" height="3.2" fill="#1A73E8" />
      <text
        x="12"
        y="16.4"
        textAnchor="middle"
        fontSize="7.2"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#1A73E8"
      >
        31
      </text>
    </svg>
  );
}

export const INTEGRATION_ICONS: Record<
  IntegrationId,
  React.ComponentType<React.ComponentProps<"svg">>
> = {
  "google-calendar": GoogleCalendarIcon,
};

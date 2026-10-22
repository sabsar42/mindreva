import { getMyPastSelf } from "@/lib/services/past-self.service";
import { getMyRiver } from "@/lib/services/mindmap.service";
import { getMyToday } from "@/lib/services/profile.service";
import { getMyCalendarStatus } from "@/lib/services/calendar.service";
import { PastSelfScreen } from "./past-self-screen";

export default async function PastSelfPage() {
  const [years, river, todayKey, calendar] = await Promise.all([
    getMyPastSelf(),
    // The river is a bonus on this screen, never a dependency: if it fails to
    // load, Re-live Me still works and the panel just shows its empty state.
    getMyRiver().catch(() => ({
      themes: [],
      intersections: [],
      insight: null,
      monthsCovered: [],
      computedAt: null,
    })),
    getMyToday().catch(() => null),
    getMyCalendarStatus().catch(() => null),
  ]);

  return (
    <PastSelfScreen
      years={years}
      river={river}
      todayKey={todayKey}
      calendarConnected={calendar?.status === "connected"}
    />
  );
}

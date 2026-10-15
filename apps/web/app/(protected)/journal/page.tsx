import { getUser } from "@mindreva/auth/server";
import { listMyEntries } from "@/lib/services/entries.service";
import { getMyYearHeatmap } from "@/lib/services/heatmap.service";
import { EntryListScreen } from "../_components/entry-list-screen";

export default async function JournalPage() {
  // Fetched alongside the list so the activity card paints filled in on the
  // first frame instead of flashing a skeleton while the client fetches it.
  // getUser() is request-cached, so this adds no extra auth round trip.
  const [entries, heatmap, user] = await Promise.all([
    listMyEntries({ type: "journal" }),
    getMyYearHeatmap(new Date().getFullYear(), "journal").catch(() => null),
    getUser(),
  ]);

  return (
    <EntryListScreen
      type="journal"
      heading="Journal"
      entries={entries}
      initialHeatmap={
        heatmap && user
          ? {
              ownerId: user.id,
              year: heatmap.year,
              days: heatmap.days,
              currentStreak: heatmap.currentStreak,
            }
          : null
      }
    />
  );
}

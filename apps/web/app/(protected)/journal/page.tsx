import { listMyEntries, entryDatesFrom } from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";

export default async function JournalPage() {
  const entries = await listMyEntries({ type: "journal" });
  const entryDates = entryDatesFrom(entries);

  return (
    <EntryListScreen
      type="journal"
      heading="Journal"
      entries={entries}
      entryDates={entryDates}
    />
  );
}

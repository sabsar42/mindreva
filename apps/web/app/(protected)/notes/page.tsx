import { listMyEntries, entryDatesFrom } from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";

export default async function NotesPage() {
  const entries = await listMyEntries({ type: "note" });
  const entryDates = entryDatesFrom(entries);

  return (
    <EntryListScreen
      type="note"
      heading="Notes"
      entries={entries}
      entryDates={entryDates}
      newEntryHref="/notes/new"
    />
  );
}

import {
  listMyEntries,
  listMyEntryDates,
} from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";

export default async function NotesPage() {
  const [entries, entryDates] = await Promise.all([
    listMyEntries({ type: "note" }),
    listMyEntryDates("note"),
  ]);

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

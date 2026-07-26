import {
  listMyEntries,
  listMyEntryDates,
  listMyDayThumbnails,
} from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";

export default async function NotesPage() {
  const [entries, entryDates, dayThumbnails] = await Promise.all([
    listMyEntries({ type: "note" }),
    listMyEntryDates("note"),
    listMyDayThumbnails("note"),
  ]);

  return (
    <EntryListScreen
      type="note"
      heading="Notes"
      entries={entries}
      entryDates={entryDates}
      dayThumbnails={dayThumbnails}
      newEntryHref="/notes/new"
    />
  );
}

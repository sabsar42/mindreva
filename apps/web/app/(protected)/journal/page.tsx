import {
  listMyEntries,
  listMyEntryDates,
  listMyDayThumbnails,
} from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";
import { RecordEntryButton } from "./record-entry-button";

export default async function JournalPage() {
  const [entries, entryDates, dayThumbnails] = await Promise.all([
    listMyEntries({ type: "journal" }),
    listMyEntryDates("journal"),
    listMyDayThumbnails("journal"),
  ]);

  return (
    <EntryListScreen
      type="journal"
      heading="Journal"
      entries={entries}
      entryDates={entryDates}
      dayThumbnails={dayThumbnails}
      showChatLink
      floatingAction={<RecordEntryButton />}
    />
  );
}

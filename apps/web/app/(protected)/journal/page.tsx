import {
  listMyEntries,
  listMyEntryDates,
} from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";
import { RecordEntryButton } from "./record-entry-button";

export default async function JournalPage() {
  const [entries, entryDates] = await Promise.all([
    listMyEntries({ type: "journal" }),
    listMyEntryDates("journal"),
  ]);

  return (
    <EntryListScreen
      type="journal"
      heading="Journal"
      entries={entries}
      entryDates={entryDates}
      showChatLink
      floatingAction={<RecordEntryButton />}
    />
  );
}

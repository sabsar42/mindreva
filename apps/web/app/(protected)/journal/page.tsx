import { listMyEntries, entryDatesFrom } from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";
import { RecordEntryButton } from "./record-entry-button";

export default async function JournalPage() {
  const entries = await listMyEntries({ type: "journal" });
  const entryDates = entryDatesFrom(entries);

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

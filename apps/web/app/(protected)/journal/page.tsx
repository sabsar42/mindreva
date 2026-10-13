import { listMyEntries } from "@/lib/services/entries.service";
import { EntryListScreen } from "../_components/entry-list-screen";

export default async function JournalPage() {
  const entries = await listMyEntries({ type: "journal" });

  return <EntryListScreen type="journal" heading="Journal" entries={entries} />;
}

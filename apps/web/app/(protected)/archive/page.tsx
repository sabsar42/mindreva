import { listMyArchivedEntries } from "@/lib/services/entries.service";
import { ArchiveList } from "./archive-list";

export default async function ArchivePage() {
  const entries = await listMyArchivedEntries();
  return <ArchiveList entries={entries} />;
}

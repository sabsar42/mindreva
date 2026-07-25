import { listMyTrashedEntries } from "@/lib/services/entries.service";
import { TrashList } from "./trash-list";

export default async function TrashPage() {
  const entries = await listMyTrashedEntries();
  return <TrashList entries={entries} />;
}

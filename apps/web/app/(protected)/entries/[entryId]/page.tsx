import { notFound } from "next/navigation";
import { getMyEntryDetail } from "@/lib/services/entries.service";
import { EntryDetail } from "./entry-detail";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const detail = await getMyEntryDetail(entryId);
  if (!detail) notFound();

  return (
    <EntryDetail
      entryId={entryId}
      source={detail.entry.source}
      title={detail.entry.title}
      entryDate={detail.entry.entryDate}
      archived={Boolean(detail.entry.archivedAt)}
      shared={detail.shared}
      transcriptStatus={detail.transcript?.status ?? null}
      confirmedText={
        detail.transcript?.editedText ?? detail.transcript?.rawText ?? ""
      }
      summaryText={detail.summary?.summaryText ?? null}
      summaryPending={Boolean(detail.entry.summaryRetryAt) && !detail.summary}
      initialPhotos={detail.photos}
      initialTasks={detail.tasks}
    />
  );
}

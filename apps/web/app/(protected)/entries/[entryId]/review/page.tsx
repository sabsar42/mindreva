import { notFound } from "next/navigation";
import {
  getMyEntry,
  getMyEntryTranscript,
} from "@/lib/services/entries.service";
import { TranscriptReview } from "./transcript-review";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const [entry, transcript] = await Promise.all([
    getMyEntry(entryId),
    getMyEntryTranscript(entryId),
  ]);

  if (!entry || !transcript) notFound();

  return (
    <TranscriptReview
      entryId={entryId}
      initialStatus={transcript.status}
      initialText={transcript.editedText ?? transcript.rawText ?? ""}
    />
  );
}

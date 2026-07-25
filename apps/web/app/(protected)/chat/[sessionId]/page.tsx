import { notFound } from "next/navigation";
import {
  countEntriesInSessionRange,
  getMyChatSession,
  listMyChatMessages,
} from "@/lib/services/persona-chat.service";
import { getMyEntryDatesByIds } from "@/lib/services/entries.service";
import { ChatConversation } from "./chat-conversation";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getMyChatSession(sessionId);
  if (!session) notFound();

  const [messages, entryCount] = await Promise.all([
    listMyChatMessages(sessionId),
    countEntriesInSessionRange(sessionId),
  ]);

  const allCitedIds = [
    ...new Set(
      messages.flatMap(
        (m) => m.citedEntryIds?.split(",").filter(Boolean) ?? [],
      ),
    ),
  ];
  const entryDates = await getMyEntryDatesByIds(allCitedIds);

  return (
    <ChatConversation
      sessionId={sessionId}
      title={session.title ?? "Chat"}
      yearStart={session.personaYearStart}
      yearEnd={session.personaYearEnd}
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citedEntryIds: m.citedEntryIds?.split(",").filter(Boolean) ?? [],
      }))}
      initialEntryDates={entryDates}
      entryCountInRange={entryCount}
    />
  );
}

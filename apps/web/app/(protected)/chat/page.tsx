import { listMyChatSessions } from "@/lib/services/persona-chat.service";
import { listMyEntryDates } from "@/lib/services/entries.service";
import { ChatHome } from "./chat-home";

export default async function ChatHomePage() {
  const [sessions, entryDates] = await Promise.all([
    listMyChatSessions(),
    listMyEntryDates(),
  ]);

  const years = [...new Set(entryDates.map((d) => Number(d.slice(0, 4))))].sort(
    (a, b) => b - a,
  );

  return <ChatHome sessions={sessions} availableYears={years} />;
}

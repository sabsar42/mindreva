import { listMyChatSessions } from "@/lib/services/persona-chat.service";
import { listMyEntryDates } from "@/lib/services/entries.service";
import { ChatHome } from "./chat-home";

export default async function ChatHomePage() {
  const [sessions, entryDates] = await Promise.all([
    listMyChatSessions(),
    listMyEntryDates(),
  ]);

  // Entries per year, so each year chip can show how much there is to draw on
  // — picking a year with 2 entries should feel different from one with 40.
  const countsByYear = new Map<number, number>();
  for (const d of entryDates) {
    const year = Number(d.slice(0, 4));
    countsByYear.set(year, (countsByYear.get(year) ?? 0) + 1);
  }
  const years = [...countsByYear.keys()].sort((a, b) => b - a);

  return (
    <ChatHome
      sessions={sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt.toISOString(),
      }))}
      availableYears={years}
      entryCountsByYear={Object.fromEntries(countsByYear)}
    />
  );
}

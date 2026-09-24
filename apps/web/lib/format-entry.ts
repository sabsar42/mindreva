export function formatEntryDateTime(
  createdAt: Date | string | null | undefined,
): string | undefined {
  if (!createdAt) return undefined;
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

export function formatDuration(ms: number | null): string | undefined {
  if (!ms || ms <= 0) return undefined;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return "< 1 min";
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} min`;
}

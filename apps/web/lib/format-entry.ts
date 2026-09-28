// Timestamps depend on the viewer's time zone, which the server doesn't know.
// Render this until hydration (see useHydrated) so SSR and client markup match
// and the card's metadata row keeps its height.
export const DATE_PLACEHOLDER = " ";

export function formatEntryDateTime(
  createdAt: Date | string | null | undefined,
): string | undefined {
  if (!createdAt) return undefined;
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return (
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

export function formatDuration(ms: number | null): string | undefined {
  if (!ms || ms <= 0) return undefined;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} min`;
}

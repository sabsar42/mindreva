import { describe, expect, it } from "vitest";
import {
  buildPastSelf,
  conversationSession,
  halfOfDate,
  rangeLabel,
  sessionName,
  windowFor,
  type SessionConversation,
  type SessionEntry,
} from "./sessions";

function entry(
  id: string,
  entryDate: string | null,
  createdAt?: string,
): SessionEntry {
  return {
    id,
    title: id,
    entryDate,
    createdAt: createdAt ?? `${entryDate ?? "2026-01-01"}T10:00:00.000Z`,
    snippet: null,
  };
}

function conversation(
  id: string,
  createdAt: string,
  persona: Partial<SessionConversation> = {},
): SessionConversation {
  return {
    id,
    createdAt,
    personaYearStart: null,
    personaYearEnd: null,
    personaHalf: null,
    ...persona,
  };
}

describe("half-year windows", () => {
  it("assigns months 1-6 to the first half and 7-12 to the second", () => {
    expect(halfOfDate("2026-01-01")).toBe(1);
    expect(halfOfDate("2026-06-30")).toBe(1);
    expect(halfOfDate("2026-07-01")).toBe(2);
    expect(halfOfDate("2026-12-31")).toBe(2);
  });

  it("produces inclusive date bounds", () => {
    expect(windowFor(2026, 1)).toMatchObject({
      key: "2026-H1",
      start: "2026-01-01",
      end: "2026-06-30",
    });
    expect(windowFor(2026, 2)).toMatchObject({
      key: "2026-H2",
      start: "2026-07-01",
      end: "2026-12-31",
    });
  });

  it("labels the span with the year", () => {
    expect(rangeLabel(2026, 1)).toBe("January – June 2026");
    expect(rangeLabel(2025, 2)).toBe("July – December 2025");
  });
});

describe("session names", () => {
  it("never gives the two halves of a year the same name", () => {
    for (let year = 2000; year < 2060; year++) {
      expect(sessionName(year, 1)).not.toBe(sessionName(year, 2));
    }
  });

  it("is stable and differs between neighbouring years", () => {
    expect(sessionName(2026, 1)).toBe(sessionName(2026, 1));
    expect(sessionName(2026, 1)).not.toBe(sessionName(2027, 1));
    expect(sessionName(2026, 2)).not.toBe(sessionName(2027, 2));
  });
});

describe("buildPastSelf", () => {
  it("gives every year exactly two sessions, first half then second half", () => {
    const years = buildPastSelf([entry("a", "2026-03-05")], []);
    expect(years).toHaveLength(1);
    expect(years[0]!.sessions.map((s) => s.key)).toEqual([
      "2026-H1",
      "2026-H2",
    ]);
    // The untouched half exists but is empty, rather than missing.
    expect(years[0]!.sessions[1]!.entries).toEqual([]);
  });

  it("files each entry under the correct half by its date", () => {
    const years = buildPastSelf(
      [
        entry("jan", "2026-01-02"),
        entry("jun", "2026-06-30"),
        entry("jul", "2026-07-01"),
        entry("dec", "2026-12-31"),
      ],
      [],
    );
    const [h1, h2] = years[0]!.sessions;
    expect(h1.entries.map((e) => e.id)).toEqual(["jan", "jun"]);
    expect(h2.entries.map((e) => e.id)).toEqual(["jul", "dec"]);
  });

  it("does not create a session per entry or per month", () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      entry(`e${i}`, `2026-${String((i % 12) + 1).padStart(2, "0")}-10`),
    );
    const years = buildPastSelf(entries, []);
    expect(years).toHaveLength(1);
    expect(years[0]!.sessions).toHaveLength(2);
    const total = years[0]!.sessions.reduce((n, s) => n + s.entries.length, 0);
    expect(total).toBe(30);
  });

  it("sorts years newest first and entries oldest to newest", () => {
    const years = buildPastSelf(
      [
        entry("late", "2025-05-20"),
        entry("early", "2025-02-01"),
        entry("newer-year", "2026-04-04"),
      ],
      [],
    );
    expect(years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(years[1]!.sessions[0]!.entries.map((e) => e.id)).toEqual([
      "early",
      "late",
    ]);
  });

  it("files an undated entry under the day it was created", () => {
    const years = buildPastSelf(
      [entry("x", null, "2024-09-09T08:00:00.000Z")],
      [],
    );
    expect(years[0]!.year).toBe(2024);
    expect(years[0]!.sessions[1]!.entries.map((e) => e.id)).toEqual(["x"]);
  });

  it("includes a year that only has a conversation", () => {
    const years = buildPastSelf(
      [],
      [
        conversation("c", "2026-10-13T10:00:00Z", {
          personaYearStart: 2023,
          personaYearEnd: 2023,
          personaHalf: 1,
        }),
      ],
    );
    expect(years.map((y) => y.year)).toEqual([2023]);
    expect(years[0]!.sessions[0]!.conversations).toHaveLength(1);
  });

  it("returns nothing for no data", () => {
    expect(buildPastSelf([], [])).toEqual([]);
  });
});

describe("conversationSession", () => {
  it("uses the half a conversation was started for", () => {
    expect(
      conversationSession(
        conversation("c", "2026-10-13T10:00:00Z", {
          personaYearStart: 2025,
          personaYearEnd: 2025,
          personaHalf: 2,
        }),
      ),
    ).toEqual({ year: 2025, half: 2 });
  });

  it("files an old whole-year conversation by when it was held, within that year", () => {
    expect(
      conversationSession(
        conversation("c", "2026-02-10T10:00:00Z", {
          personaYearStart: 2026,
          personaYearEnd: 2026,
        }),
      ),
    ).toEqual({ year: 2026, half: 1 });
  });

  it("files an old conversation about an earlier year under that year's second half", () => {
    expect(
      conversationSession(
        conversation("c", "2026-02-10T10:00:00Z", {
          personaYearStart: 2024,
          personaYearEnd: 2024,
        }),
      ),
    ).toEqual({ year: 2024, half: 2 });
  });

  it("files a multi-year conversation under its last year", () => {
    expect(
      conversationSession(
        conversation("c", "2026-10-10T10:00:00Z", {
          personaYearStart: 2021,
          personaYearEnd: 2023,
        }),
      ),
    ).toEqual({ year: 2023, half: 2 });
  });
});

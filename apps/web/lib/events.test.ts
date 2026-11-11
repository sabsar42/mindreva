import { describe, expect, it } from "vitest";
import { parseEventBlock, parseTaskBlock } from "@mindreva/llm";
import {
  buildEventBody,
  insertEvent,
  GoogleForbiddenError,
  GoogleUnauthorizedError,
} from "./integrations/google/calendar-api";

describe("parseEventBlock", () => {
  it("returns the text untouched when there is no events block", () => {
    expect(parseEventBlock("You went running.")).toEqual({
      rest: "You went running.",
      events: [],
    });
  });

  it("reads timed and all-day events and strips the block", () => {
    const out = parseEventBlock(
      "You have plans.\n===EVENTS===\n- 2026-11-13 15:00 | Dentist appointment\n- 2026-11-14 | Mum's birthday",
    );
    expect(out.rest).toBe("You have plans.");
    expect(out.events).toEqual([
      { date: "2026-11-13", time: "15:00", title: "Dentist appointment" },
      { date: "2026-11-14", time: null, title: "Mum's birthday" },
    ]);
  });

  it("pads single-digit hours and skips impossible dates and times", () => {
    const out = parseEventBlock(
      "S\n===EVENTS===\n- 2026-11-13 9:30 | Standup\n- 2026-02-31 | Not a day\n- 2026-11-13 25:00 | Bad time\n- no date here",
    );
    expect(out.events).toEqual([
      { date: "2026-11-13", time: "09:30", title: "Standup" },
    ]);
  });

  it("keeps the tasks block when the model puts it after the events", () => {
    const out = parseEventBlock(
      "Summary.\n===EVENTS===\n- 2026-11-13 15:00 | Dentist\n===TASKS===\n- Buy milk",
    );
    expect(out.events).toHaveLength(1);
    expect(parseTaskBlock(out.rest)).toEqual({
      summaryText: "Summary.",
      tasks: ["Buy milk"],
    });
  });

  it("does not let event lines leak into the tasks", () => {
    const out = parseEventBlock(
      "Summary.\n===TASKS===\n- Buy milk\n===EVENTS===\n- 2026-11-13 | Party",
    );
    expect(parseTaskBlock(out.rest).tasks).toEqual(["Buy milk"]);
    expect(out.events).toEqual([
      { date: "2026-11-13", time: null, title: "Party" },
    ]);
  });
});

describe("buildEventBody", () => {
  it("makes a one-hour timed event in the user's time zone", () => {
    expect(
      buildEventBody(
        { title: "Dentist", startDate: "2026-11-13", startTime: "15:00" },
        "Asia/Dhaka",
      ),
    ).toMatchObject({
      summary: "Dentist",
      start: { dateTime: "2026-11-13T15:00:00", timeZone: "Asia/Dhaka" },
      end: { dateTime: "2026-11-13T16:00:00", timeZone: "Asia/Dhaka" },
    });
  });

  it("rolls past midnight correctly", () => {
    const body = buildEventBody(
      { title: "Late", startDate: "2026-12-31", startTime: "23:30" },
      "UTC",
    );
    expect(body.end).toEqual({
      dateTime: "2027-01-01T00:30:00",
      timeZone: "UTC",
    });
  });

  it("makes an all-day event ending the next day", () => {
    const body = buildEventBody(
      { title: "Birthday", startDate: "2026-11-30", startTime: null },
      "UTC",
    );
    expect(body.start).toEqual({ date: "2026-11-30" });
    expect(body.end).toEqual({ date: "2026-12-01" });
  });
});

describe("insertEvent", () => {
  const body = buildEventBody(
    { title: "X", startDate: "2026-11-13", startTime: null },
    "UTC",
  );
  const reply = (status: number) =>
    (async () => new Response("{}", { status })) as unknown as typeof fetch;

  it("posts our own id and reports created", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    expect(await insertEvent("tok", "primary", "abc123", body, f)).toBe(
      "created",
    );
    expect(sent!.url).toContain("/calendars/primary/events");
    expect(JSON.parse(String(sent!.init.body)).id).toBe("abc123");
  });

  it("treats a duplicate id (409) as already added", async () => {
    expect(await insertEvent("t", "primary", "id", body, reply(409))).toBe(
      "exists",
    );
  });

  it("maps 401 and 403 to their own errors", async () => {
    await expect(
      insertEvent("t", "primary", "id", body, reply(401)),
    ).rejects.toBeInstanceOf(GoogleUnauthorizedError);
    await expect(
      insertEvent("t", "primary", "id", body, reply(403)),
    ).rejects.toBeInstanceOf(GoogleForbiddenError);
  });
});

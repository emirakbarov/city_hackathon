import { describe, expect, it } from "vitest";
import { examsFromIcs, parseIcs, parseIcsDate } from "./ics";

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "SUMMARY:Maths Midterm",
  "DTSTART;VALUE=DATE:20261205",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Physics final exam in the big ",
  " hall",
  "DTSTART:20261210T093000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Chemistry quiz",
  "DTSTART;TZID=Europe/London:20261208T140000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Dinner with Sam",
  "DTSTART:20261206T190000",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("ics", () => {
  it("parses DATE, UTC and TZID/floating DTSTART values", () => {
    expect(parseIcsDate("20261205")).toBe("2026-12-05T09:00:00");
    expect(parseIcsDate("20261210T093000Z")).toBe("2026-12-10T09:30:00.000Z");
    expect(parseIcsDate("20261208T140000")).toBe("2026-12-08T14:00:00");
    expect(parseIcsDate("nonsense")).toBeNull();
  });
  it("reads every VEVENT and unfolds folded lines", () => {
    const evs = parseIcs(ICS);
    expect(evs).toHaveLength(4);
    expect(evs[1]!.summary).toBe("Physics final exam in the big hall");
    expect(evs[2]!.start).toBe("2026-12-08T14:00:00");
  });
  it("keeps only exam-like events, importance 2, and dedupes by title + day", () => {
    let n = 0;
    const first = examsFromIcs(ICS, [], () => `id${n++}`);
    expect(first.map((e) => e.title)).toEqual(["Maths Midterm", "Physics final exam in the big hall", "Chemistry quiz"]);
    expect(first.every((e) => e.importance === 2)).toBe(true);
    expect(examsFromIcs(ICS, first)).toHaveLength(0);
    expect(examsFromIcs(ICS + "\r\n" + ICS, [])).toHaveLength(3);
  });
});

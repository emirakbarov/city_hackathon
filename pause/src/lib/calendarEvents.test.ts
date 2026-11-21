import { describe, it, expect } from "vitest";
import { mapEvent } from "./calendarEvents";

describe("mapEvent", () => {
  it("all-day 21–24 Oct covers 21–23 Oct", () => {
    const r = mapEvent({ id: "a", summary: "Trip", start: { date: "2026-10-21" }, end: { date: "2026-10-24" } });
    expect(r?.due_date).toBe("2026-10-21");
    expect(r?.end_date).toBe("2026-10-23");
  });
  it("single all-day 30 Oct ends 30 Oct", () => {
    const r = mapEvent({ id: "b", start: { date: "2026-10-30" }, end: { date: "2026-10-31" } });
    expect(r?.end_date).toBe("2026-10-30");
  });
  it("timed keeps full times with offsets", () => {
    const r = mapEvent({ id: "c", summary: "Maths exam", start: { dateTime: "2026-11-25T09:00:00+01:00" }, end: { dateTime: "2026-11-25T11:30:00+01:00" } });
    expect(r?.starts_at).toBe("2026-11-25T09:00:00+01:00");
    expect(r?.ends_at).toBe("2026-11-25T11:30:00+01:00");
    expect(r?.kind).toBe("exam");
    expect(r?.all_day).toBe(false);
  });
});

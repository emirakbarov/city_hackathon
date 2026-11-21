import { describe, it, expect } from "vitest";
import { needsDailyCheckIn, productiveOptions } from "./productivity";

describe("daily productive choices", () => {
  const now = new Date(2026, 10, 21, 12);
  it("asks once per local day and asks again on the next day", () => {
    expect(needsDailyCheckIn(null, now)).toBe(true);
    expect(needsDailyCheckIn("2026-11-21", now)).toBe(false);
    expect(needsDailyCheckIn("2026-11-21", new Date(2026, 10, 22, 0, 1))).toBe(true);
  });
  it("offers the user's own objective first", () => {
    expect(productiveOptions([], { day: "2026-11-21", objective: "Revise chemistry", energy: "steady", available_minutes: 15 }, [], now)[0]?.title).toBe("Revise chemistry");
  });
  it("offers Duolingo only when entered as an interest", () => {
    expect(productiveOptions(["Duolingo"], null, [], now).some(o => o.url === "https://www.duolingo.com/learn")).toBe(true);
    expect(productiveOptions(["Chess"], null, [], now).some(o => o.url === "https://www.duolingo.com/learn")).toBe(false);
  });
  it("uses an upcoming commitment rather than a past one", () => {
    const options = productiveOptions([], null, [{ title: "Past exam", due_date: "2026-11-20" }, { title: "Essay", due_date: "2026-11-22" }], now);
    expect(options.some(o => o.title === "Work on Essay")).toBe(true);
    expect(options.some(o => o.title === "Work on Past exam")).toBe(false);
  });
});
import { describe, expect, it } from "vitest";
import { CANCEL_LIMIT_URL, timerExpired, timerMinutes } from "./scrollTimer";
import { passUrl } from "./pause";

describe("selected scroll timer", () => {
  it("cancels through the Pause Cancel shortcut, never directly through Instagram or a fresh timed pass", () => {
    expect(CANCEL_LIMIT_URL).toBe("shortcuts://run-shortcut?name=Pause%20Cancel");
  });
  it("hands the wheel's 20 minutes to Pause Pass", () => {
    expect(passUrl(20)).toBe("shortcuts://run-shortcut?name=Pause%20Pass&input=text&text=20");
  });
  it("expires exactly 20 minutes after starting", () => {
    const start = Date.parse("2026-11-21T16:00:00Z");
    const expires = "2026-11-21T16:20:00Z";
    expect(timerExpired(expires, start + 20 * 60_000 - 1)).toBe(false);
    expect(timerExpired(expires, start + 20 * 60_000)).toBe(true);
  });
  it("stays expired on repeated later Instagram opens without a daily reset", () => {
    const expires = "2026-11-21T16:20:00Z";
    for (const now of ["2026-11-21T16:21:00Z", "2026-11-21T17:00:00Z", "2026-11-22T16:00:00Z"]) {
      expect(timerExpired(expires, Date.parse(now))).toBe(true);
    }
  });
  it("accepts only selected limits from 1 to 45 minutes", () => {
    expect(timerMinutes("20")).toBe(20);
    expect(timerMinutes("45")).toBe(45);
    expect(timerMinutes("46")).toBeUndefined();
    expect(timerMinutes("0")).toBeUndefined();
    expect(timerMinutes("20.5")).toBeUndefined();
  });
  it("does not mark a missing or invalid expiry as expired", () => {
    expect(timerExpired(undefined)).toBe(false);
    expect(timerExpired("not-a-date")).toBe(false);
  });
});
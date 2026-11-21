import { describe, expect, it } from "vitest";
import { isValidUsername, latestPerUser, whatsappLink, isLogged, ACTIVITIES, SHORTCUT_URL } from "./pause";

describe("pause rules", () => {
  it("usernames are 3-20 lowercase letters, digits or underscore", () => {
    expect(isValidUsername("emir_a")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("Emir")).toBe(false);
  });
  it("continue opens the Pause Pass shortcut, never instagram:// directly", () => {
    expect(SHORTCUT_URL).toBe("shortcuts://run-shortcut?name=Pause%20Pass");
  });
  it("offers exactly the five preset activities", () => {
    expect(ACTIVITIES).toEqual(["Call?", "Grab food?", "Go for a walk?", "Gym?", "Play something?"]);
  });
  it("builds a WhatsApp link from a phone number", () => {
    expect(whatsappLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsappLink("")).toBeNull();
  });
  it("keeps only the latest session per friend", () => {
    const rows = [
      { user_id: "a", created_at: "2026-01-01T10:00:00Z" },
      { user_id: "a", created_at: "2026-01-01T10:05:00Z" },
      { user_id: "b", created_at: "2026-01-01T10:01:00Z" },
    ];
    expect(latestPerUser(rows).map((r) => r.created_at)).toEqual(["2026-01-01T10:05:00Z", "2026-01-01T10:01:00Z"]);
  });
  it("counts a session only when it ended in something else or scrolling", () => {
    expect(isLogged("redirected")).toBe(true);
    expect(isLogged("continued")).toBe(true);
    expect(isLogged("pending")).toBe(false);
    expect(isLogged("cancelled")).toBe(false);
    expect(isLogged("unfinished")).toBe(false);
  });
});

import { nextMinutes, dragMinutes, MAX_MIN } from "@/components/pause/LimitSlider";
describe("scroll limit slider", () => {
  const W = 350; // phone-width track
  it("dragging is easy up to 30 min", () => {
    expect(nextMinutes(1, W, W) - 1).toBeGreaterThanOrEqual(14);
  });
  it("past 30 the same drag gains only a few minutes", () => {
    expect(nextMinutes(31, W, W) - 31).toBeLessThanOrEqual(10);
  });
  it("past 30 every minute costs the same drag", () => {
    const near30 = dragMinutes(30.01, W, W) - 30.01;
    const near40 = dragMinutes(35, W, W) - 35;
    expect(near40).toBeCloseTo(near30, 1);
  });
  it("45 is reachable in two full drags from 30", () => {
    const afterOne = nextMinutes(30, W, W);
    expect(afterOne).toBeGreaterThan(30);
    expect(nextMinutes(afterOne, W, W)).toBeGreaterThanOrEqual(45);
  });
  it("early minutes come faster than minutes near 30", () => {
    expect(dragMinutes(1, 50, W) - 1).toBeGreaterThan(dragMinutes(25, 50, W) - 25);
  });
  it("tiny drags past 30 still add up instead of freezing", () => {
    const half = dragMinutes(32, W / 2, W);
    expect(half).toBeGreaterThan(32);
    expect(dragMinutes(half, W / 2, W)).toBeGreaterThan(half);
  });
  it("1 and 45 are the hard bounds", () => {
    expect(nextMinutes(44, 5000, W)).toBeLessThanOrEqual(MAX_MIN);
    expect(nextMinutes(1, -5000, W)).toBe(1);
  });
});

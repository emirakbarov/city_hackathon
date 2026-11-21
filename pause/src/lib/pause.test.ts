import { describe, expect, it } from "vitest";
import { isValidUsername, latestPerUser, whatsappLink, ACTIVITIES, SHORTCUT_URL } from "./pause";

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
});

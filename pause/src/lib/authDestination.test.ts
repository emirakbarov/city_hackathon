import { describe, expect, it } from "vitest";
import { safeNext } from "./authDestination";

describe("sign-in destination", () => {
  it("preserves the Instagram check-in destination", () => {
    expect(safeNext("/intercept?app=instagram")).toBe("/intercept?app=instagram");
  });
  it("never redirects credentials to another origin", () => {
    for (const destination of ["https://other.example", "//other.example", "/\\other.example", "/\n/other.example"]) {
      expect(safeNext(destination)).toBe("/");
    }
  });
});
import { describe, expect, it } from "vitest";
import { daysUntilDue } from "@/lib/data";

describe("cleaning due dates", () => {
  it("never-done task is due today", () => expect(daysUntilDue(null, 7, "2026-10-23")).toBe(0));
  it("weekly task done 3 days ago is due in 4 days", () => expect(daysUntilDue("2026-10-20", 7, "2026-10-23")).toBe(4));
  it("weekly task done 9 days ago is 2 days overdue", () => expect(daysUntilDue("2026-10-14", 7, "2026-10-23")).toBe(-2));
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { nextLastDone } from "@/lib/data";

const today = "2026-10-23";

describe("ticking and un-ticking a task", () => {
  it("ticking saves today", () => expect(nextLastDone("2026-10-16", today, undefined)).toBe(today));
  it("un-ticking restores the date the tick replaced", () => expect(nextLastDone(today, today, "2026-10-16")).toBe("2026-10-16"));
  it("un-ticking a first-ever completion clears it", () => expect(nextLastDone(today, today, null)).toBeNull());
  it("un-ticking with nothing remembered clears it (as before)", () => expect(nextLastDone(today, today, undefined)).toBeNull());
});

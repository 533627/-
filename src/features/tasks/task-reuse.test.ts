import { describe, expect, it } from "vitest";

import {
  formatChinaDateTimeLocal,
  nextReusableDueAt,
  previousChinaDayRange,
} from "@/features/tasks/task-reuse";

describe("task reuse dates", () => {
  it("uses the previous complete Beijing calendar day", () => {
    const range = previousChinaDayRange(new Date("2026-08-15T02:30:00.000Z"));

    expect(range.start.toISOString()).toBe("2026-08-13T16:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-14T16:00:00.000Z");
  });

  it("moves a reusable deadline forward by one day", () => {
    const dueAt = nextReusableDueAt(
      new Date("2026-08-14T10:00:00.000Z"),
      new Date("2026-08-15T02:00:00.000Z"),
    );

    expect(dueAt.toISOString()).toBe("2026-08-15T10:00:00.000Z");
  });

  it("never prefills an expired deadline", () => {
    const dueAt = nextReusableDueAt(
      new Date("2026-08-12T10:00:00.000Z"),
      new Date("2026-08-15T02:00:00.000Z"),
    );

    expect(dueAt.toISOString()).toBe("2026-08-16T02:00:00.000Z");
  });

  it("formats a deadline for a Beijing datetime-local input", () => {
    expect(formatChinaDateTimeLocal(new Date("2026-08-15T10:05:00.000Z"))).toBe("2026-08-15T18:05");
  });
});

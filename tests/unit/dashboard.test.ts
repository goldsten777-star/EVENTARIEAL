import { describe, expect, it } from "vitest";
import { cumulativeTimeline, percent } from "@/lib/dashboard/stats";

describe("percent", () => {
  it("rounds and guards against zero", () => {
    expect(percent(268, 412)).toBe(65);
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });
});

describe("cumulativeTimeline", () => {
  it("fills every day up to today and accumulates", () => {
    const points = cumulativeTimeline(
      [
        { day: "2026-11-10", attending: 2, declined: 0 },
        { day: "2026-11-12", attending: 1, declined: 1 },
      ],
      "2026-11-14",
    );
    expect(points).toEqual([
      { day: "2026-11-10", attending: 2, declined: 0 },
      { day: "2026-11-11", attending: 2, declined: 0 },
      { day: "2026-11-12", attending: 3, declined: 1 },
      { day: "2026-11-13", attending: 3, declined: 1 },
      { day: "2026-11-14", attending: 3, declined: 1 },
    ]);
  });

  it("caps the window but keeps earlier answers as the starting level", () => {
    const points = cumulativeTimeline(
      [
        { day: "2026-01-01", attending: 5, declined: 2 },
        { day: "2026-11-14", attending: 1, declined: 0 },
      ],
      "2026-11-14",
      3,
    );
    expect(points).toEqual([
      { day: "2026-11-12", attending: 5, declined: 2 },
      { day: "2026-11-13", attending: 5, declined: 2 },
      { day: "2026-11-14", attending: 6, declined: 2 },
    ]);
  });

  it("returns nothing without answers", () => {
    expect(cumulativeTimeline([], "2026-11-14")).toEqual([]);
  });
});

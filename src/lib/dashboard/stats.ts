/** Shape of the JSON returned by the event_stats database function. */
export type EventStats = {
  totals: {
    parties: number;
    people_invited: number;
    adults_invited: number;
    children_invited: number;
    attending_parties: number;
    attending_people: number;
    attending_adults: number;
    attending_children: number;
    declined_parties: number;
    declined_people: number;
    pending_parties: number;
    pending_people: number;
    arrived_parties: number;
    arrived_people: number;
    invitations_not_sent: number;
    invitations_sent: number;
    invitations_viewed: number;
    seated_people: number;
    unseated_people: number;
  };
  tables: { tables_count: number; total_capacity: number };
  money: { budget_total: number; planned_total: number; actual_total: number; paid_total: number };
  gifts: { gifts_count: number; gifts_total: number };
  by_group: Array<{ name: string; color: string; invited: number; attending: number; declined: number }>;
  by_category: Array<{ category: string; planned: number; actual: number; paid: number }>;
  timeline: Array<{ day: string; attending: number; declined: number }>;
};

/** Whole-number percentage; 0 when the total is 0. */
export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export type TimelinePoint = { day: string; attending: number; declined: number };

function addDays(isoDay: string, n: number) {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Cumulative responses per day, one point per calendar day from the first
 * response (or `maxDays` back, with earlier answers as the starting level)
 * up to `today`, so gaps between answers are drawn as flat stretches.
 */
export function cumulativeTimeline(rows: EventStats["timeline"], today: string, maxDays = 90): TimelinePoint[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted[sorted.length - 1].day > today ? sorted[sorted.length - 1].day : today;
  let start = sorted[0].day;
  const earliestShown = addDays(last, -(maxDays - 1));
  if (start < earliestShown) start = earliestShown;

  let attending = 0;
  let declined = 0;
  const byDay = new Map(sorted.map((r) => [r.day, r]));
  for (const r of sorted) {
    if (r.day < start) {
      attending += r.attending;
      declined += r.declined;
    }
  }

  const points: TimelinePoint[] = [];
  for (let day = start; day <= last; day = addDays(day, 1)) {
    const r = byDay.get(day);
    if (r) {
      attending += r.attending;
      declined += r.declined;
    }
    points.push({ day, attending, declined });
  }
  return points;
}

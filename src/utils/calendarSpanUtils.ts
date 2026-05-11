import { WorkoutSession } from '../types';

export function ymdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface SpanSegment {
  workout: WorkoutSession;
  startCol: number;
  endCol: number;
  lane: number;
}

function spanPriority(w: WorkoutSession): number {
  if (
    w.id.startsWith('cluster-my-') ||
    w.id.startsWith('trip-span-') ||
    w.id.startsWith('my-trip-span-') ||
    w.id.startsWith('my-trip-')
  ) {
    return 0;
  }
  if (
    w.id.startsWith('cluster-f-') ||
    w.id.startsWith('friend-trip-span-') ||
    w.id.startsWith('friend-trip-')
  ) {
    return 1;
  }
  return 2;
}

/** Segments of spanning trips that fall within Sun–Sat of weekSunday. */
export function buildSpanSegmentsForWeek(
  weekSunday: Date,
  spanningWorkouts: WorkoutSession[]
): SpanSegment[] {
  const ws = new Date(weekSunday);
  ws.setHours(0, 0, 0, 0);
  const weTime = new Date(ws);
  weTime.setDate(weTime.getDate() + 6);
  const wsKey = ymdFromDate(ws);
  const weKey = ymdFromDate(weTime);

  const raw: Omit<SpanSegment, 'lane'>[] = [];
  for (const w of spanningWorkouts) {
    if (!w.spanningEndDate) continue;
    const startKey = ymdFromDate(new Date(w.startTime));
    const endKey = w.spanningEndDate;
    if (endKey < wsKey || startKey > weKey) continue;
    const segStartKey = startKey > wsKey ? startKey : wsKey;
    const segEndKey = endKey < weKey ? endKey : weKey;
    const [sy, sm, sd] = segStartKey.split('-').map(Number);
    const [ey, em, ed] = segEndKey.split('-').map(Number);
    const segStart = new Date(sy, sm - 1, sd);
    const segEnd = new Date(ey, em - 1, ed);
    const startCol = Math.round((segStart.getTime() - ws.getTime()) / 86400000);
    const endCol = Math.round((segEnd.getTime() - ws.getTime()) / 86400000);
    const sc = Math.max(0, Math.min(6, startCol));
    const ec = Math.max(0, Math.min(6, endCol));
    if (sc <= ec) raw.push({ workout: w, startCol: sc, endCol: ec });
  }

  raw.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      spanPriority(a.workout) - spanPriority(b.workout) ||
      a.endCol - b.endCol
  );
  const laneEnds: number[] = [];
  const out: SpanSegment[] = [];
  for (const seg of raw) {
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] >= seg.startCol) lane++;
    laneEnds[lane] = seg.endCol;
    out.push({ ...seg, lane });
  }
  return out;
}

export function isSpanningTripEvent(w: WorkoutSession): boolean {
  return Boolean(w.spanningEndDate);
}

function partitionPriority(w: WorkoutSession): number {
  return spanPriority(w);
}

/**
 * Cap distinct spanning trips per week row; remainder go to overflow list for "+N more" UI.
 */
export function monthWeekSpanningPartition(
  weekSunday: Date,
  spanningWorkouts: WorkoutSession[],
  maxVisibleLanes: number | undefined
): {
  rowSegs: SpanSegment[];
  overflowWorkouts: WorkoutSession[];
  displayLaneCount: number;
} {
  const allSegs = buildSpanSegmentsForWeek(weekSunday, spanningWorkouts);
  const uniqueMap = new Map<string, WorkoutSession>();
  for (const s of allSegs) uniqueMap.set(s.workout.id, s.workout);
  const unique = Array.from(uniqueMap.values());

  unique.sort((a, b) => {
    const p = partitionPriority(a) - partitionPriority(b);
    if (p !== 0) return p;
    const ta = a.startTime.getTime();
    const tb = b.startTime.getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  if (maxVisibleLanes == null || maxVisibleLanes < 2) {
    const lanes = allSegs.length ? Math.max(...allSegs.map((s) => s.lane)) + 1 : 0;
    return { rowSegs: allSegs, overflowWorkouts: [], displayLaneCount: lanes };
  }

  const cap = maxVisibleLanes - 1;
  let shown: WorkoutSession[];
  let overflow: WorkoutSession[];
  if (unique.length <= cap) {
    shown = unique;
    overflow = [];
  } else {
    shown = unique.slice(0, cap);
    overflow = unique.slice(cap);
  }

  const rowSegs = buildSpanSegmentsForWeek(weekSunday, shown);
  const baseLanes = rowSegs.length ? Math.max(...rowSegs.map((s) => s.lane)) + 1 : 0;
  const displayLaneCount = baseLanes + (overflow.length > 0 ? 1 : 0);
  return { rowSegs, overflowWorkouts: overflow, displayLaneCount };
}

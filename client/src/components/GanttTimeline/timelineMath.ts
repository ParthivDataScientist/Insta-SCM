import type { TimelineBarLayout, TimelineViewMode } from '../../types/domain';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseUTCDate(dateValue: Date | string | number | null | undefined): Date {
  if (dateValue instanceof Date) {
    return new Date(
      Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()),
    );
  }

  if (!dateValue) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  if (typeof dateValue === 'string') {
    const parts = dateValue.split('-');
    if (parts.length === 3) {
      return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    }
  }

  const parsed = new Date(dateValue);
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

export function formatUTCDate(dateValue: Date | string | number | null | undefined): string {
  return parseUTCDate(dateValue).toISOString().split('T')[0];
}

export function addDaysUTC(
  dateValue: Date | string | number | null | undefined,
  days: number,
): Date {
  const next = parseUTCDate(dateValue);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function diffDaysUTC(
  fromDate: Date | string | number | null | undefined,
  toDate: Date | string | number | null | undefined,
): number {
  return Math.round(
    (parseUTCDate(toDate).getTime() - parseUTCDate(fromDate).getTime()) / MS_PER_DAY,
  );
}

export function getDaysInMonthUTC(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function getPxPerDay(
  dateValue: Date | string | number | null | undefined,
  cellWidth: number,
  viewMode: TimelineViewMode,
): number {
  if (viewMode === 'Day') return cellWidth;
  if (viewMode === 'Week') return cellWidth / 7;

  const date = parseUTCDate(dateValue);
  return cellWidth / getDaysInMonthUTC(date.getUTCFullYear(), date.getUTCMonth());
}

export function dateToTimelinePx(
  dateValue: Date | string | number | null | undefined,
  timelineStart: Date | string | number | null | undefined,
  cellWidth: number,
  viewMode: TimelineViewMode,
): number {
  const start = parseUTCDate(timelineStart);
  const date = parseUTCDate(dateValue);

  if (viewMode !== 'Month') {
    return diffDaysUTC(start, date) * getPxPerDay(date, cellWidth, viewMode);
  }

  const cursor = new Date(start.getTime());
  let px = 0;

  while (
    cursor.getUTCFullYear() < date.getUTCFullYear() ||
    (cursor.getUTCFullYear() === date.getUTCFullYear() &&
      cursor.getUTCMonth() < date.getUTCMonth())
  ) {
    px += cellWidth;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }

  return px + (date.getUTCDate() - 1) * getPxPerDay(date, cellWidth, viewMode);
}

export function pxToTimelineDate(
  px: number,
  timelineStart: Date | string | number | null | undefined,
  cellWidth: number,
  viewMode: TimelineViewMode,
): Date {
  const start = parseUTCDate(timelineStart);
  const safePx = Math.max(0, px);

  if (viewMode === 'Day') {
    return addDaysUTC(start, Math.round(safePx / cellWidth));
  }

  if (viewMode === 'Week') {
    return addDaysUTC(start, Math.round(safePx / (cellWidth / 7)));
  }

  let dayOffset = 0;
  let current = parseUTCDate(start);
  let currentPx = dateToTimelinePx(current, start, cellWidth, viewMode);

  while (dayOffset < 900) {
    const next = addDaysUTC(current, 1);
    const nextPx = dateToTimelinePx(next, start, cellWidth, viewMode);
    const midpoint = currentPx + (nextPx - currentPx) / 2;

    if (safePx < midpoint) {
      return current;
    }

    current = next;
    currentPx = nextPx;
    dayOffset += 1;
  }

  return current;
}

/**
 * Maps a date range to horizontal bar geometry on the timeline.
 *
 * Why normalize end: inverted ranges would render negative widths; clamping keeps
 * layout stable when upstream data is partially filled.
 */
export function getBarLayout(
  startDate: Date | string | number | null | undefined,
  endDate: Date | string | number | null | undefined,
  timelineStart: Date | string | number | null | undefined,
  cellWidth: number,
  viewMode: TimelineViewMode,
): TimelineBarLayout {
  const normalizedStart = parseUTCDate(startDate);
  const normalizedEnd = parseUTCDate(endDate || startDate);
  const safeEnd = normalizedEnd < normalizedStart ? normalizedStart : normalizedEnd;
  const left = dateToTimelinePx(normalizedStart, timelineStart, cellWidth, viewMode);
  const right = dateToTimelinePx(addDaysUTC(safeEnd, 1), timelineStart, cellWidth, viewMode);

  return {
    left,
    width: Math.max(getPxPerDay(safeEnd, cellWidth, viewMode), right - left),
  };
}

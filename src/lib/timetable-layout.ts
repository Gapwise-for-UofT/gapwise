import type { Meeting, Weekday } from "@/lib/timetable-types";
import { visibleWeekdaysForMeetings } from "@/lib/timetable-types";

type DayLayout = {
  laneCount: number;
  placement: Map<string, number>;
  sorted: Meeting[];
};

export type TimetableCardDensity = "full" | "compact" | "dense" | "micro";
export type TimetableCardWidthMode = "normal" | "compact" | "narrow";

export interface TimetableCardLayoutInfo {
  density: TimetableCardDensity;
  widthMode: TimetableCardWidthMode;
  showIcon: boolean;
  showTitle: boolean;
  inlineTimeLocation: boolean;
  compactTime: boolean;
  compactBadge: boolean;
}

/**
 * Computes deliberate density and width modes for timetable event cards based on
 * the physical rendered dimensions (height in px and horizontal lane count).
 *
 * Density hierarchy:
 * - full: ample vertical room (>=85px) and single lane; displays code+badge, time, location, title
 * - compact: moderate height (58px-84px, e.g. 60 min at 66px); displays code+badge, time, location (title hidden first)
 * - dense: short height (38px-57px, e.g. 50 min at 55px or narrow 60 min); displays code+badge, time · location on single line
 * - micro: very short (<38px, e.g. 30 min at 33px); micro 2-row layout: code, time · room
 */
export function getTimetableCardLayout(
  height: number,
  laneCount: number = 1,
): TimetableCardLayoutInfo {
  const widthMode: TimetableCardWidthMode =
    laneCount >= 3 ? "narrow" : laneCount === 2 ? "compact" : "normal";

  let density: TimetableCardDensity;
  if (laneCount >= 3) {
    if (height >= 95) density = "compact";
    else if (height >= 48) density = "dense";
    else density = "micro";
  } else if (laneCount === 2) {
    if (height >= 85) density = "compact";
    else if (height >= 44) density = "dense";
    else density = "micro";
  } else {
    if (height >= 85) density = "full";
    else if (height >= 58) density = "compact";
    else if (height >= 38) density = "dense";
    else density = "micro";
  }

  return {
    density,
    widthMode,
    showIcon: widthMode === "normal" && density !== "micro",
    showTitle: density === "full" && widthMode === "normal",
    inlineTimeLocation: density === "dense" || density === "micro",
    compactTime: widthMode !== "normal" || density === "micro",
    compactBadge: widthMode !== "normal" || density === "micro",
  };
}

/** Hides optional detail when a short or narrow card cannot display four readable lines. */
export function isCompactMeetingCard(meeting: Meeting, laneCount: number): boolean {
  return laneCount > 1 || meeting.endTime - meeting.startTime <= 60;
}

/** Assigns overlapping meetings to side-by-side lanes so nothing visually collides. */
function layout(day: Meeting[]): DayLayout {
  const sorted = [...day].sort((a, b) => a.startTime - b.startTime);
  const lanes: Meeting[][] = [];
  const placement = new Map<string, number>();
  for (const meeting of sorted) {
    let laneIndex = lanes.findIndex(
      (lane) => (lane[lane.length - 1]?.endTime ?? 0) <= meeting.startTime,
    );
    if (laneIndex === -1) {
      lanes.push([]);
      laneIndex = lanes.length - 1;
    }
    lanes[laneIndex]!.push(meeting);
    placement.set(meeting.id, laneIndex);
  }
  return { laneCount: Math.max(1, lanes.length), placement, sorted };
}

export function buildTimetableModel(
  meetings: Meeting[],
  visibleDays: readonly Weekday[] = visibleWeekdaysForMeetings(meetings),
) {
  const meetingsByDay = new Map<Weekday, Meeting[]>(visibleDays.map((weekday) => [weekday, []]));
  let earliestMinute = Number.POSITIVE_INFINITY;
  let latestMinute = Number.NEGATIVE_INFINITY;

  for (const meeting of meetings) {
    meetingsByDay.get(meeting.weekday)?.push(meeting);
    earliestMinute = Math.min(earliestMinute, meeting.startTime);
    latestMinute = Math.max(latestMinute, meeting.endTime);
  }

  if (meetings.length === 0) {
    return {
      startHour: 7,
      hours: [] as number[],
      days: new Map(visibleDays.map((weekday) => [weekday, layout([])])),
    };
  }

  const startHour = Math.max(7, Math.floor(earliestMinute / 60) - 1);
  const endHour = Math.min(23, Math.ceil(latestMinute / 60) + 1);
  const hours = Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => startHour + i);
  const days = new Map(
    visibleDays.map((weekday) => [weekday, layout(meetingsByDay.get(weekday) ?? [])] as const),
  );
  return { startHour, hours, days };
}

/** Compresses only multi-hour stretches that contain no classes anywhere in the week. */
export function buildTimetableScale(
  hours: number[],
  meetings: Meeting[],
  compact: boolean,
  fullHourHeight = 66,
  compactHourHeight = 26,
) {
  const occupiedHours = new Set<number>();
  for (const hour of hours) {
    const hourStart = hour * 60;
    if (
      meetings.some((meeting) => meeting.startTime < hourStart + 60 && meeting.endTime > hourStart)
    ) {
      occupiedHours.add(hour);
    }
  }

  const compactableHours = new Set<number>();
  let emptyRun: number[] = [];
  const finishRun = () => {
    if (emptyRun.length >= 2) emptyRun.forEach((hour) => compactableHours.add(hour));
    emptyRun = [];
  };

  for (const hour of hours) {
    if (occupiedHours.has(hour)) finishRun();
    else emptyRun.push(hour);
  }
  finishRun();

  const hourHeights = new Map<number, number>();
  for (const hour of hours) {
    hourHeights.set(
      hour,
      compact && compactableHours.has(hour) ? compactHourHeight : fullHourHeight,
    );
  }

  const minuteToTop = (minute: number) => {
    let top = 0;
    for (const hour of hours) {
      const hourStart = hour * 60;
      const height = hourHeights.get(hour) ?? fullHourHeight;
      if (minute >= hourStart + 60) {
        top += height;
        continue;
      }
      if (minute > hourStart) top += ((minute - hourStart) / 60) * height;
      break;
    }
    return top;
  };

  return { compactableHours, hourHeights, minuteToTop };
}

import campusJson from "@/data/campuses/queens/campus.json";
import type { Meeting, ParsedTimetable, Weekday } from "@/lib/timetable-types";
import { queens } from "./config";
import { parseIcs } from "./ics-parser";
import { parseQueensText } from "./text-parser";
import type { CampusSnapshot, Day, Meeting as QueensMeeting } from "../common/model";

export const queensCampus = campusJson as unknown as CampusSnapshot;

const weekdays: Record<Day, Weekday> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour! * 60 + minute!;
}

export function normalizeQueensMeeting(source: QueensMeeting): Meeting[] {
  const building = queensCampus.buildings.find((item) => item.id === source.location.buildingId);
  const component = source.nativeComponentType.toUpperCase();
  const activityType =
    component === "LEC" ||
    component === "TUT" ||
    component === "PRA" ||
    component === "LAB" ||
    component === "SEM"
      ? component
      : "OTHER";
  const term = source.termLabel.startsWith("Winter")
    ? "Winter"
    : source.termLabel.startsWith("Summer")
      ? "Summer"
      : "Fall";

  return source.days.map((day) => ({
    id: `${source.id}:${day}`,
    universityId: "queens",
    courseCode: source.courseCode,
    activityType,
    sectionCode: source.nativeSection,
    nativeSection: source.nativeSection,
    nativeComponentType: source.nativeComponentType,
    courseName: source.courseName ?? source.courseCode,
    startTime: minutes(source.startTime),
    endTime: minutes(source.endTime),
    weekday: weekdays[day],
    buildingCode: building?.nativeCodes[0] ?? null,
    room: source.location.room,
    term,
    campus: "QUEENS",
    locationUnknown: source.location.kind !== "physical",
    locationType: source.location.kind,
    sourceLocation: source.location.nativeText,
    dateRange: { startDate: source.startDate, endDate: source.endDate },
    recurrenceIntervalWeeks: 1,
  }));
}

export function parseQueensIcs(text: string): ParsedTimetable {
  const parsed = parseIcs(text, queensCampus, queens);
  return { meetings: parsed.meetings.flatMap(normalizeQueensMeeting), warnings: parsed.warnings };
}

export function parseTimetable(text: string): ParsedTimetable {
  if (text.includes("BEGIN:VCALENDAR")) {
    return parseQueensIcs(text);
  }
  const parsed = parseQueensText(text, queensCampus, queens);
  return { meetings: parsed.meetings.flatMap(normalizeQueensMeeting), warnings: parsed.warnings };
}

export const parseQueensTimetable = parseTimetable;

import { DEMO_QUEENS_MEETINGS } from "./demo-timetable";

export function loadQueensDemoTimetable(): Meeting[] {
  return DEMO_QUEENS_MEETINGS.flatMap(normalizeQueensMeeting);
}

export const queensScheduleAdapter = {
  universityId: "queens",
  label: "Queen's SOLUS & Calendar Subscription",
  acceptedInputs: [".ics", "text/calendar", "text/plain"],
  detect(text: string): boolean {
    return text.includes("BEGIN:VCALENDAR") || /\b[A-Z]{3,4}\s*\d{3,4}[A-Z]?\b/i.test(text);
  },
  validate(text: string): { valid: boolean; error?: string } {
    const trimmed = text.trim();
    if (!trimmed) return { valid: false, error: "Schedule input cannot be empty." };
    return { valid: true };
  },
  parse(text: string): ParsedTimetable {
    return parseTimetable(text);
  },
};

import campusJson from "@/data/campuses/york/campus.json";
import type { Meeting, ParsedTimetable, Weekday } from "@/lib/timetable-types";
import { york } from "./config";
import { parseIcs } from "./ics-parser";
import { parseYorkText } from "./text-parser";
import type { CampusSnapshot, Day, Meeting as YorkMeeting } from "../common/model";

export const yorkCampus = campusJson as unknown as CampusSnapshot;

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

export function normalizeYorkMeeting(source: YorkMeeting): Meeting[] {
  const building = yorkCampus.buildings.find((item) => item.id === source.location.buildingId);
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
    universityId: "york",
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
    campus: "KEELE",
    locationUnknown: source.location.kind !== "physical",
    locationType: source.location.kind,
    sourceLocation: source.location.nativeText,
    dateRange: { startDate: source.startDate, endDate: source.endDate },
    recurrenceIntervalWeeks: 1,
  }));
}

export function parseYorkIcs(text: string): ParsedTimetable {
  const parsed = parseIcs(text, yorkCampus, york);
  return { meetings: parsed.meetings.flatMap(normalizeYorkMeeting), warnings: parsed.warnings };
}

export function parseTimetable(text: string): ParsedTimetable {
  if (text.includes("BEGIN:VCALENDAR")) {
    return parseYorkIcs(text);
  }
  const parsed = parseYorkText(text, yorkCampus, york);
  return { meetings: parsed.meetings.flatMap(normalizeYorkMeeting), warnings: parsed.warnings };
}

export const parseYorkTimetable = parseTimetable;

import { DEMO_YORK_MEETINGS } from "./demo-timetable";

export function loadYorkDemoTimetable(): Meeting[] {
  return DEMO_YORK_MEETINGS.flatMap(normalizeYorkMeeting);
}

export const yorkScheduleAdapter = {
  universityId: "york",
  label: "York Visual Schedule Builder & REM",
  acceptedInputs: [".ics", "text/calendar", "text/plain"],
  detect(text: string): boolean {
    return text.includes("BEGIN:VCALENDAR") || /\b[A-Z]{2,4}\s*\d{4}\b/i.test(text);
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

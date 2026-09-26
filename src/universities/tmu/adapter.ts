import campusJson from "@/data/campuses/tmu/campus.json";
import type { Meeting, ParsedTimetable, Weekday } from "@/lib/timetable-types";
import { tmu } from "./config";
import { parseIcs } from "./ics-parser";
import { parseTmuText } from "./text-parser";
import type { CampusSnapshot, Day, Meeting as TmuMeeting } from "../common/model";

export const tmuCampus = campusJson as unknown as CampusSnapshot;

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

export function normalizeTmuMeeting(source: TmuMeeting): Meeting[] {
  const building = tmuCampus.buildings.find((item) => item.id === source.location.buildingId);
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
    universityId: "tmu",
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
    campus: "TMU",
    locationUnknown: source.location.kind !== "physical",
    locationType: source.location.kind,
    sourceLocation: source.location.nativeText,
    dateRange: { startDate: source.startDate, endDate: source.endDate },
    recurrenceIntervalWeeks: 1,
  }));
}

export function parseTmuIcs(text: string): ParsedTimetable {
  const parsed = parseIcs(text, tmuCampus, tmu);
  return { meetings: parsed.meetings.flatMap(normalizeTmuMeeting), warnings: parsed.warnings };
}

export function parseTimetable(text: string): ParsedTimetable {
  if (text.includes("BEGIN:VCALENDAR")) {
    return parseTmuIcs(text);
  }
  const parsed = parseTmuText(text, tmuCampus, tmu);
  return { meetings: parsed.meetings.flatMap(normalizeTmuMeeting), warnings: parsed.warnings };
}

export const parseTmuTimetable = parseTimetable;

import { DEMO_TMU_MEETINGS } from "./demo-timetable";

export function loadTmuDemoTimetable(): Meeting[] {
  return DEMO_TMU_MEETINGS.flatMap(normalizeTmuMeeting);
}

export const tmuScheduleAdapter = {
  universityId: "tmu",
  label: "TMU MyServiceHub & Google Calendar",
  acceptedInputs: [".ics", "text/calendar", "text/plain"],
  detect(text: string): boolean {
    return text.includes("BEGIN:VCALENDAR") || /\b[A-Z]{3}\s*\d{3}\b/i.test(text);
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

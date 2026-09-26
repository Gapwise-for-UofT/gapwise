import campusJson from "@/data/campuses/mcmaster/campus.json";
import type { Meeting, ParsedTimetable, Weekday } from "@/lib/timetable-types";
import { mcmaster } from "./config";
import { parseIcs } from "./ics-parser";
import { parseMcMasterText } from "./text-parser";
import type { CampusSnapshot, Day, Meeting as McMasterMeeting } from "../common/model";

export const mcmasterCampus = campusJson as unknown as CampusSnapshot;

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

export function normalizeMcMasterMeeting(source: McMasterMeeting): Meeting[] {
  const building = mcmasterCampus.buildings.find((item) => item.id === source.location.buildingId);
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
    universityId: "mcmaster",
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
    campus: "MCMASTER",
    locationUnknown: source.location.kind !== "physical",
    locationType: source.location.kind,
    sourceLocation: source.location.nativeText,
    dateRange: { startDate: source.startDate, endDate: source.endDate },
    recurrenceIntervalWeeks: 1,
  }));
}

export function parseMcMasterIcs(text: string): ParsedTimetable {
  const parsed = parseIcs(text, mcmasterCampus, mcmaster);
  return { meetings: parsed.meetings.flatMap(normalizeMcMasterMeeting), warnings: parsed.warnings };
}

export function parseTimetable(text: string): ParsedTimetable {
  if (text.includes("BEGIN:VCALENDAR")) {
    return parseMcMasterIcs(text);
  }
  const parsed = parseMcMasterText(text, mcmasterCampus, mcmaster);
  return { meetings: parsed.meetings.flatMap(normalizeMcMasterMeeting), warnings: parsed.warnings };
}

export const parseMcMasterTimetable = parseTimetable;

import { DEMO_MCMASTER_MEETINGS } from "./demo-timetable";

export function loadMcMasterDemoTimetable(): Meeting[] {
  return DEMO_MCMASTER_MEETINGS.flatMap(normalizeMcMasterMeeting);
}

export const mcmasterScheduleAdapter = {
  universityId: "mcmaster",
  label: "McMaster Mosaic & Outlook Calendar",
  acceptedInputs: [".ics", "text/calendar", "text/plain"],
  detect(text: string): boolean {
    return text.includes("BEGIN:VCALENDAR") || /\b[A-Z]{3,8}\s*\d[A-Z0-9]{2,3}\b/i.test(text);
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

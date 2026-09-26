import campusJson from "@/data/campuses/uottawa/campus.json";
import type { Meeting, ParsedTimetable, Weekday } from "@/lib/timetable-types";
import { uottawa } from "./config";
import { parseIcs } from "./ics-parser";
import { parseUOttawaText } from "./text-parser";
import type { CampusSnapshot, Day, Meeting as UOttawaMeeting } from "../common/model";

export const uottawaCampus = campusJson as unknown as CampusSnapshot;

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

export function normalizeUOttawaMeeting(source: UOttawaMeeting): Meeting[] {
  const building = uottawaCampus.buildings.find((item) => item.id === source.location.buildingId);
  const component = source.nativeComponentType.toUpperCase();
  const activityType =
    component === "LEC" ||
    component === "TUT" ||
    component === "PRA" ||
    component === "LAB" ||
    component === "SEM"
      ? component
      : component === "DGD"
        ? "TUT"
        : "OTHER";
  const term =
    source.termLabel.startsWith("Winter") || source.termLabel.startsWith("Hiver")
      ? "Winter"
      : source.termLabel.startsWith("Summer") || source.termLabel.startsWith("Été")
        ? "Summer"
        : "Fall";

  return source.days.map((day) => ({
    id: `${source.id}:${day}`,
    universityId: "uottawa",
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
    campus: "UOTTAWA",
    locationUnknown: source.location.kind !== "physical",
    locationType: source.location.kind,
    sourceLocation: source.location.nativeText,
    dateRange: { startDate: source.startDate, endDate: source.endDate },
    recurrenceIntervalWeeks: 1,
  }));
}

export function parseUOttawaIcs(text: string): ParsedTimetable {
  const parsed = parseIcs(text, uottawaCampus, uottawa);
  return { meetings: parsed.meetings.flatMap(normalizeUOttawaMeeting), warnings: parsed.warnings };
}

export function parseTimetable(text: string): ParsedTimetable {
  if (text.includes("BEGIN:VCALENDAR")) {
    return parseUOttawaIcs(text);
  }
  const parsed = parseUOttawaText(text, uottawaCampus, uottawa);
  return { meetings: parsed.meetings.flatMap(normalizeUOttawaMeeting), warnings: parsed.warnings };
}

export const parseUOttawaTimetable = parseTimetable;

import { DEMO_UOTTAWA_MEETINGS } from "./demo-timetable";

export function loadUOttawaDemoTimetable(): Meeting[] {
  return DEMO_UOTTAWA_MEETINGS.flatMap(normalizeUOttawaMeeting);
}

export const uottawaScheduleAdapter = {
  universityId: "uottawa",
  label: "uOttawa uoZone & Enrolment",
  acceptedInputs: [".ics", "text/calendar", "text/plain"],
  detect(text: string): boolean {
    return text.includes("BEGIN:VCALENDAR") || /\b[A-Z]{3,4}\s*\d{4}\b/i.test(text);
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

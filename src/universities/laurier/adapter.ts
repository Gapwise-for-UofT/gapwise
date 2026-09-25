import campusJson from "@/data/campuses/laurier/campus.json";
import type { Meeting, ParsedTimetable, Weekday } from "@/lib/timetable-types";
import { laurier } from "./config";
import { parseIcs } from "./ics-parser";
import { parseLaurierText } from "./text-parser";
import type { CampusSnapshot, Day, Meeting as LaurierMeeting } from "../common/model";

export const laurierCampus = campusJson as unknown as CampusSnapshot;

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

export function normalizeLaurierMeeting(source: LaurierMeeting): Meeting[] {
  const building = laurierCampus.buildings.find((item) => item.id === source.location.buildingId);
  const component = source.nativeComponentType.toUpperCase();
  const activityType =
    component === "LEC" || component === "TUT" || component === "PRA" || component === "LAB"
      ? component === "LAB"
        ? "PRA"
        : component
      : "OTHER";
  const term = source.termLabel.startsWith("Winter")
    ? "Winter"
    : source.termLabel.startsWith("Summer")
      ? "Summer"
      : "Fall";

  return source.days.map((day) => ({
    id: `${source.id}:${day}`,
    universityId: "laurier",
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
    campus: "WATERLOO",
    locationUnknown: source.location.kind !== "physical",
    locationType: source.location.kind,
    sourceLocation: source.location.nativeText,
    dateRange: { startDate: source.startDate, endDate: source.endDate },
    recurrenceIntervalWeeks: 1,
  }));
}

export function parseLaurierIcs(text: string): ParsedTimetable {
  const parsed = parseIcs(text, laurierCampus, laurier);
  return { meetings: parsed.meetings.flatMap(normalizeLaurierMeeting), warnings: parsed.warnings };
}

export function parseTimetable(text: string): ParsedTimetable {
  if (text.includes("BEGIN:VCALENDAR")) {
    return parseLaurierIcs(text);
  }
  const parsed = parseLaurierText(text, laurierCampus, laurier);
  return { meetings: parsed.meetings.flatMap(normalizeLaurierMeeting), warnings: parsed.warnings };
}

export const parseLaurierTimetable = parseTimetable;

import { DEMO_LAURIER_MEETINGS } from "./demo-timetable";

export function loadLaurierDemoTimetable(): Meeting[] {
  return DEMO_LAURIER_MEETINGS.flatMap(normalizeLaurierMeeting);
}

export const laurierScheduleAdapter = {
  universityId: "laurier",
  label: "Laurier LORIS & MyLearningSpace",
  acceptedInputs: [".ics", "text/calendar", "text/plain"],
  detect(text: string): boolean {
    return text.includes("BEGIN:VCALENDAR") || /\b[A-Z]{2,4}\s*\d{3}[A-Z]?\b/i.test(text);
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

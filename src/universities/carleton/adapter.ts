import campusJson from "@/data/campuses/carleton/campus.json";
import type { Meeting, ParsedTimetable, Weekday } from "@/lib/timetable-types";
import { carleton } from "./config";
import { parseIcs } from "./ics-parser";
import { parseCarletonText } from "./text-parser";
import type { CampusSnapshot, Day, Meeting as CarletonMeeting } from "./model";

export const carletonCampus = campusJson as unknown as CampusSnapshot;

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

export function normalizeCarletonMeeting(source: CarletonMeeting): Meeting[] {
  const building = carletonCampus.buildings.find((item) => item.id === source.location.buildingId);
  const component = source.nativeComponentType.toUpperCase();
  const activityType =
    component === "LEC" || component === "TUT" || component === "PRA" ? component : "OTHER";
  const term = source.termLabel.startsWith("Winter")
    ? "Winter"
    : source.termLabel.startsWith("Summer")
      ? "Summer"
      : "Fall";
  return source.days.map((day) => ({
    id: `${source.id}:${day}`,
    universityId: "carleton",
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
    campus: "CARLETON",
    locationUnknown: source.location.kind !== "physical",
    locationType: source.location.kind,
    sourceLocation: source.location.nativeText,
    dateRange: { startDate: source.startDate, endDate: source.endDate },
    recurrenceIntervalWeeks: 1,
  }));
}

export function parseCarletonIcs(text: string): ParsedTimetable {
  const parsed = parseIcs(text, carletonCampus, carleton);
  return { meetings: parsed.meetings.flatMap(normalizeCarletonMeeting), warnings: parsed.warnings };
}

export function parseCarletonTimetable(text: string): ParsedTimetable {
  if (text.includes("BEGIN:VCALENDAR")) {
    return parseCarletonIcs(text);
  }
  const parsed = parseCarletonText(text, carletonCampus, carleton);
  return { meetings: parsed.meetings.flatMap(normalizeCarletonMeeting), warnings: parsed.warnings };
}

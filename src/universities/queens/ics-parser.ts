import ICAL from "ical.js";
import type { CampusSnapshot, Day, InstitutionAdapter, Meeting } from "../common/model";
import { resolveLocation } from "../common/meetings";

const ICAL_DAY_INDEX: Day[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const TORONTO_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function torontoParts(value: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  zone?: { tzid?: string };
  toJSDate?: () => Date;
}) {
  if (!value.zone?.tzid || value.zone.tzid === "floating") return value;
  const parts = Object.fromEntries(
    TORONTO_FORMATTER.formatToParts(value.toJSDate!()).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
    hour: Number(parts["hour"]),
    minute: Number(parts["minute"]),
  };
}

function parseSummary(summary: string): {
  courseCode: string;
  nativeSection: string;
  nativeComponentType: string;
  courseName: string;
} {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  // Queen's codes e.g. "CISC 121 001 LEC - Intro to CS", "MATH 120", "COMM 101"
  const courseMatch = cleaned.match(/\b([A-Z]{3,4})\s*(\d{3,4})([A-Z0-9]*)\b/i);
  const courseCode = courseMatch
    ? `${courseMatch[1]!.toUpperCase()} ${courseMatch[2]!}`
    : cleaned || "UNKNOWN";
  let section = courseMatch && courseMatch[3] ? courseMatch[3].toUpperCase() : "";

  const compMatch = cleaned.match(/\b(LEC|TUT|LAB|SEM|GRP|WKS|PRC|REC|DIS)\b/i);
  const nativeComponentType = compMatch ? compMatch[1]!.toUpperCase() : "LEC";

  if (!section) {
    const remainder = courseMatch ? cleaned.slice(courseMatch.index! + courseMatch[0].length) : "";
    const secMatch = remainder.match(/^\s*(?:(?:SEC|SECTION|SECT)\s+)?([A-Z0-9]{1,4})\b/i);
    if (
      secMatch &&
      secMatch[1] &&
      !["LEC", "TUT", "LAB", "SEM", "GRP", "WKS", "PRC"].includes(secMatch[1].toUpperCase())
    ) {
      section = secMatch[1].toUpperCase();
    }
  }

  let courseName = "";
  const parts = cleaned.split(/[-–—:]/);
  if (parts.length > 1) {
    courseName = parts.slice(1).join(" ").trim();
  } else if (courseMatch) {
    courseName = cleaned
      .slice(courseMatch.index! + courseMatch[0].length)
      .replace(/^\s*(?:(?:SEC|SECTION|SECT)\s+)?[A-Z0-9]{1,4}\b/i, "")
      .replace(/^\s*(?:\(?\b(?:LEC|TUT|LAB|SEM|GRP|WKS|PRC|REC|DIS)\b\)?)\s*/i, "")
      .trim();
  }

  return {
    courseCode,
    nativeSection: section || "001",
    nativeComponentType,
    courseName: courseName || courseCode,
  };
}

export function parseIcs(
  icsContent: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): { meetings: Meeting[]; warnings: string[] } {
  const warnings: string[] = [];
  const meetings: Meeting[] = [];

  let parsed: unknown;
  try {
    parsed = ICAL.parse(icsContent);
  } catch (e) {
    warnings.push(`iCalendar parse failed: ${e instanceof Error ? e.message : String(e)}`);
    return { meetings: [], warnings };
  }

  const comp = new ICAL.Component(parsed as unknown[]);
  const vevents = comp.getAllSubcomponents("vevent");

  if (vevents.length === 0) {
    warnings.push("No VEVENT components found in calendar.");
    return { meetings: [], warnings };
  }

  const seenIds = new Set<string>();

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    const summary = event.summary ?? "";
    const locationRaw = event.location ?? "";
    const dtstart = event.startDate;
    const dtend = event.endDate;

    if (!dtstart) {
      warnings.push(`Skipping event "${summary}" because it has no start date.`);
      continue;
    }

    const { courseCode, nativeSection, nativeComponentType, courseName } = parseSummary(summary);
    if (!courseCode || courseCode === "UNKNOWN") continue;

    const rruleProp = vevent.getFirstProperty("rrule");
    let days: Day[] = [];
    let untilDate: string | null = null;

    if (rruleProp) {
      const rruleVal = rruleProp.getFirstValue() as {
        parts?: Record<string, string | string[]>;
        until?: { toJSDate: () => Date };
      } | null;
      if (rruleVal?.parts?.["BYDAY"]) {
        const rawDays = rruleVal.parts["BYDAY"];
        const dayList = Array.isArray(rawDays) ? rawDays : [rawDays];
        days = dayList
          .map((d: string) => d.slice(-2).toUpperCase() as Day)
          .filter((d: Day) => ICAL_DAY_INDEX.includes(d));
      }
      if (rruleVal?.until) {
        const u = torontoParts(rruleVal.until);
        untilDate = `${u.year}-${pad2(u.month)}-${pad2(u.day)}`;
      }
    }

    const startLocal = torontoParts(dtstart);
    const endLocal = dtend ? torontoParts(dtend) : startLocal;

    if (days.length === 0) {
      const jsDate = dtstart.toJSDate();
      days = [ICAL_DAY_INDEX[jsDate.getDay()]!];
    }

    const startTime = `${pad2(startLocal.hour)}:${pad2(startLocal.minute)}`;
    const endTime = `${pad2(endLocal.hour)}:${pad2(endLocal.minute)}`;
    const startDate = `${startLocal.year}-${pad2(startLocal.month)}-${pad2(startLocal.day)}`;
    const endDate = untilDate ?? startDate;

    const termMonth = startLocal.month;
    const detectedTerm = termMonth >= 9 ? "Fall" : termMonth >= 5 ? "Summer" : "Winter";
    const termLabel = `${detectedTerm} ${startLocal.year}`;

    const kind = /online|web|virtual/i.test(locationRaw)
      ? "online"
      : locationRaw.trim()
        ? "physical"
        : "tba";
    const location = resolveLocation(locationRaw || "TBA", kind, campus);

    const baseId = `${adapter.id}-${courseCode.replace(/\s+/g, "-")}-${nativeSection}-${days.join("")}-${startTime}`.toLowerCase();
    if (seenIds.has(baseId)) continue;
    seenIds.add(baseId);

    meetings.push({
      id: baseId,
      institutionId: adapter.id,
      courseCode,
      nativeSection,
      nativeComponentType,
      courseName,
      termLabel,
      days,
      startTime,
      endTime,
      startDate,
      endDate,
      location,
      source: {
        kind: "ics-import",
        recordedAt: new Date().toISOString(),
      },
    });
  }

  return { meetings, warnings };
}

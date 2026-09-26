import type { CampusSnapshot, InstitutionAdapter, LocationKind, Meeting } from "../common/model";
import { resolveLocation } from "../common/meetings";

interface ParsedIcsResult {
  meetings: Meeting[];
  warnings: string[];
}

function parseIcsDate(val: string): Date | null {
  const clean = val.replace(/^.*:/, "").trim();
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!match) return null;
  const [, y, m, d, hh = "00", mm = "00", ss = "00"] = match;
  return new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)),
  );
}

function formatTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const BYDAY_MAP: Record<string, Meeting["days"][number]> = {
  MO: "MO",
  TU: "TU",
  WE: "WE",
  TH: "TH",
  FR: "FR",
  SA: "SA",
  SU: "SU",
};

function parseSummary(summary: string): {
  courseCode: string;
  nativeSection: string;
  nativeComponentType: string;
  courseName: string;
} {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  // McMaster codes e.g. "COMPSCI 1MD3 C01 LEC - Intro to Programming", "MATH 1ZA3", "ENGINEER 1P13"
  const courseMatch = cleaned.match(/\b([A-Z]{3,8})\s*(\d[A-Z0-9]{2,3})\b/i);
  const courseCode = courseMatch
    ? `${courseMatch[1]!.toUpperCase()} ${courseMatch[2]!.toUpperCase()}`
    : cleaned || "UNKNOWN";

  const compMatch = cleaned.match(/\b(LEC|TUT|LAB|SEM|PRA|CLN)\b/i);
  const nativeComponentType = compMatch ? compMatch[1]!.toUpperCase() : "LEC";

  let section = "";
  let courseName = "";

  if (!section) {
    const remainder = courseMatch ? cleaned.slice(courseMatch.index! + courseMatch[0].length) : "";
    const secMatch = remainder.match(/^\s*(?:(?:SEC|SECTION|SECT)\s+)?([A-Z0-9]{1,4})\b/i);
    if (
      secMatch &&
      secMatch[1] &&
      !["LEC", "TUT", "LAB", "SEM", "PRA", "CLN"].includes(secMatch[1].toUpperCase())
    ) {
      section = secMatch[1].toUpperCase();
    }
  }

  const dashIndex = cleaned.indexOf("-");
  if (dashIndex !== -1) {
    courseName = cleaned.slice(dashIndex + 1).trim();
  } else if (courseMatch) {
    courseName = cleaned
      .slice(courseMatch.index! + courseMatch[0].length)
      .replace(/^\s*(?:(?:SEC|SECTION|SECT)\s+)?[A-Z0-9]{1,4}\b/i, "")
      .replace(/^\s*(?:\(?\b(?:LEC|TUT|LAB|SEM|PRA|CLN)\b\)?)\s*/i, "")
      .trim();
  }

  return {
    courseCode,
    nativeSection: section || "C01",
    nativeComponentType,
    courseName: courseName || courseCode,
  };
}

export function parseIcs(
  icsText: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): ParsedIcsResult {
  const meetings: Meeting[] = [];
  const warnings: string[] = [];

  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const events = unfolded.split("BEGIN:VEVENT").slice(1);

  if (events.length === 0) {
    warnings.push("No calendar events found in file.");
    return { meetings, warnings };
  }

  for (const ev of events) {
    const end = ev.indexOf("END:VEVENT");
    const block = end !== -1 ? ev.slice(0, end) : ev;

    const getField = (name: string): string => {
      const match = block.match(new RegExp(`^(?:${name})(?:;[^:]*)?:(.*)$`, "m"));
      return match && match[1] ? match[1].trim() : "";
    };

    const uid = getField("UID") || `event-${meetings.length + 1}`;
    const summary = getField("SUMMARY");
    const locationRaw = getField("LOCATION");
    const dtstart = getField("DTSTART");
    const dtend = getField("DTEND");
    const rrule = getField("RRULE");

    if (!summary) continue;

    const startDate = dtstart ? parseIcsDate(dtstart) : null;
    const endDate = dtend ? parseIcsDate(dtend) : null;

    if (!startDate || !endDate) {
      warnings.push(`Skipped event "${summary}": invalid DTSTART or DTEND`);
      continue;
    }

    const startTime = formatTime(startDate);
    const endTime = formatTime(endDate);

    let days: Meeting["days"] = [];
    if (rrule) {
      const bydayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
      if (bydayMatch && bydayMatch[1]) {
        days = bydayMatch[1]
          .split(",")
          .map((d) => BYDAY_MAP[d.trim()])
          .filter(Boolean) as Meeting["days"];
      }
    }
    if (days.length === 0) {
      const dayIndex = startDate.getUTCDay();
      const map: Meeting["days"][number][] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const d = map[dayIndex];
      if (d) days = [d];
    }

    let recurrenceEnd = formatDate(endDate);
    if (rrule) {
      const untilMatch = rrule.match(/UNTIL=(\d{8}(?:T\d{6}Z?)?)/);
      if (untilMatch && untilMatch[1]) {
        const u = parseIcsDate(untilMatch[1]);
        if (u) recurrenceEnd = formatDate(u);
      }
    }

    const { courseCode, nativeSection, nativeComponentType, courseName } = parseSummary(summary);
    let locationKind: LocationKind = "physical";
    if (!locationRaw || /\b(tba|to be announced)\b/i.test(locationRaw)) {
      locationKind = "tba";
    } else if (/\b(online|zoom|remote|web|asynchronous|sync|async)\b/i.test(locationRaw)) {
      locationKind = "online";
    }
    const resolvedLoc = resolveLocation(locationRaw, locationKind, campus);

    const termLabel =
      startDate.getUTCMonth() >= 8
        ? `Fall ${startDate.getUTCFullYear()}`
        : startDate.getUTCMonth() >= 4
          ? `Summer ${startDate.getUTCFullYear()}`
          : `Winter ${startDate.getUTCFullYear()}`;

    meetings.push({
      id: uid,
      institutionId: adapter.id,
      courseCode,
      nativeSection,
      nativeComponentType,
      courseName,
      termLabel,
      days,
      startTime,
      endTime,
      startDate: formatDate(startDate),
      endDate: recurrenceEnd,
      location: resolvedLoc,
      source: { kind: "official-calendar", recordedAt: new Date().toISOString() },
    });
  }

  return { meetings, warnings };
}

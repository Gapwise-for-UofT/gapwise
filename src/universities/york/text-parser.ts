import type {
  CampusSnapshot,
  Day,
  InstitutionAdapter,
  LocationKind,
  Meeting,
} from "../common/model";
import { resolveLocation } from "../common/meetings";

const BANNER_DAY_MAP: Record<string, Day> = {
  M: "MO",
  T: "TU",
  W: "WE",
  R: "TH",
  TH: "TH",
  F: "FR",
  S: "SA",
  U: "SU",
};

const WORD_DAY_MAP: Record<string, Day> = {
  MONDAY: "MO",
  MON: "MO",
  MO: "MO",
  TUESDAY: "TU",
  TUE: "TU",
  TU: "TU",
  WEDNESDAY: "WE",
  WED: "WE",
  WE: "WE",
  THURSDAY: "TH",
  THU: "TH",
  TH: "TH",
  FRIDAY: "FR",
  FRI: "FR",
  FR: "FR",
  SATURDAY: "SA",
  SAT: "SA",
  SA: "SA",
  SUNDAY: "SU",
  SUN: "SU",
  SU: "SU",
};

const IGNORED_WORDS = new Set([
  "FALL",
  "WINTER",
  "SUMMER",
  "TERM",
  "YEAR",
  "DATE",
  "WEEK",
  "DAYS",
  "TIME",
  "TYPE",
  "COURSE",
  "SECTION",
  "SEC",
  "LOCATION",
  "ROOM",
  "INSTRUCTOR",
]);

function parseDays(raw: string): Day[] {
  const result: Day[] = [];
  const wordRegex =
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRegex.exec(raw)) !== null) {
    const day = WORD_DAY_MAP[wordMatch[1]!.toUpperCase()];
    if (day && !result.includes(day)) result.push(day);
  }
  if (result.length > 0) return result;

  const tokenRegex = /\b([MTWRFSU]{1,5})\b/g;
  let tokenMatch: RegExpExecArray | null;
  const validBannerTokens = new Set([
    "MWF",
    "TR",
    "MW",
    "WF",
    "MF",
    "MTRF",
    "MTWR",
    "MTWRF",
    "M",
    "T",
    "W",
    "R",
    "F",
    "S",
    "U",
    "TH",
  ]);

  while ((tokenMatch = tokenRegex.exec(raw)) !== null) {
    const token = tokenMatch[1]!.toUpperCase();
    if (validBannerTokens.has(token)) {
      if (token === "TH") {
        if (!result.includes("TH")) result.push("TH");
      } else if (token === "TR") {
        if (!result.includes("TU")) result.push("TU");
        if (!result.includes("TH")) result.push("TH");
      } else {
        for (const ch of token) {
          const mapped = BANNER_DAY_MAP[ch];
          if (mapped && !result.includes(mapped)) result.push(mapped);
        }
      }
    }
  }

  return result;
}

function parseTimeRange(raw: string): { start: string; end: string } | null {
  const match = raw.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i,
  );
  if (!match) return null;

  const to24 = (t: string, defAmPm?: string): string | null => {
    t = t.trim();
    const ampmMatch = t.match(/(am|pm)$/i);
    let ampm = ampmMatch ? ampmMatch[1]!.toUpperCase() : defAmPm;
    const timeOnly = t.replace(/(am|pm)$/i, "").trim();
    const parts = timeOnly.split(":");
    let h = Number(parts[0]);
    const m = parts[1] ? Number(parts[1]) : 0;
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;

    if (!ampm) {
      if (h >= 1 && h <= 7) ampm = "PM";
      else if (h >= 8 && h <= 11) ampm = "AM";
      else if (h === 12) ampm = "PM";
      else ampm = "AM";
    }

    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const rawEnd = match[2]!;
  const rawStart = match[1]!;
  const endAmPm = rawEnd.match(/(am|pm)$/i)?.[1]?.toUpperCase();
  const end = to24(rawEnd);
  const start = to24(rawStart, endAmPm);

  if (start && end) return { start, end };
  return null;
}

function extractLocation(
  text: string,
  campus: CampusSnapshot,
): {
  nativeText: string;
  buildingId: string | null;
  room: string | null;
  kind: LocationKind;
} | null {
  const clean = text.trim();
  if (/\b(online|sync|async|remote|virtual|zoom|web)\b/i.test(clean)) {
    return { nativeText: clean, buildingId: null, room: null, kind: "online" };
  }

  // 1. Try standard resolver first
  const resolved = resolveLocation(clean, "physical", campus);
  if (resolved.kind === "physical" && resolved.buildingId) {
    return resolved;
  }

  // 2. Try matching building native code + room
  for (const b of campus.buildings) {
    for (const code of b.nativeCodes) {
      const regex = new RegExp(`\\b${code}\\b\\s*(?:Room\\s*)?([A-Z0-9-]+)`, "i");
      const m = clean.match(regex);
      if (m && m[1]) {
        return {
          nativeText: clean,
          buildingId: b.id,
          room: m[1],
          kind: "physical",
        };
      }
    }
  }

  return null;
}

export function parseYorkText(
  rawText: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): { meetings: Meeting[]; warnings: string[] } {
  const meetings: Meeting[] = [];
  const warnings: string[] = [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const year = new Date().getFullYear();
  const startDate = `${year}-09-09`;
  const endDate = `${year}-12-09`;

  // Strategy 1: Tabular single-line format (e.g. REM or VSB schedule view)
  for (const line of lines) {
    const courseMatches = [...line.matchAll(/\b([A-Z]{2,4})\s*(\d{4}[A-Z]?)\b/gi)];
    const validMatch = courseMatches.find((m) => !IGNORED_WORDS.has(m[1]!.toUpperCase()));
    if (!validMatch) continue;

    const timeMatch = line.match(
      /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|to|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
    );
    if (timeMatch) {
      const times = parseTimeRange(timeMatch[0]);
      if (times) {
        const courseCode = `${validMatch[1]!.toUpperCase()} ${validMatch[2]!.toUpperCase()}`;
        const beforeTime = line.slice(0, timeMatch.index!).trim();
        const afterTime = line.slice(timeMatch.index! + timeMatch[0].length).trim();

        let days = parseDays(beforeTime);
        if (days.length === 0) days = parseDays(afterTime);
        if (days.length === 0) days = ["MO", "WE", "FR"];

        const courseMatchIdx = line.indexOf(validMatch[0]);
        const courseEndIdx = courseMatchIdx >= 0 ? courseMatchIdx + validMatch[0].length : 0;
        const betweenCourseAndTime = line.slice(courseEndIdx, timeMatch.index!).trim();
        const secMatch = betweenCourseAndTime.match(/\b([A-Z]|\d{1,2}|LAB\s*\d{1,2})\b/i);
        const section = secMatch ? secMatch[1]!.toUpperCase() : "A";

        const compMatch = line.match(/\b(LEC|TUT|LAB|PRA|SEM|DIR)\b/i);
        const component = compMatch ? compMatch[1]!.toUpperCase() : "LEC";

        const locCandidate = extractLocation(afterTime, campus) ?? extractLocation(line, campus);
        const location: Meeting["location"] = locCandidate ?? {
          nativeText: afterTime || "TBA",
          buildingId: null,
          room: null,
          kind: "tba",
        };

        meetings.push({
          id: `york-text-${meetings.length + 1}`,
          institutionId: adapter.id,
          courseCode,
          nativeSection: section,
          nativeComponentType: component,
          courseName: courseCode,
          termLabel: `Fall ${year}`,
          days,
          startTime: times.start,
          endTime: times.end,
          startDate,
          endDate,
          location,
          source: { kind: "official-calendar", recordedAt: new Date().toISOString() },
        });
      }
    }
  }

  // Strategy 2: Multi-line block format
  if (meetings.length === 0) {
    let currentCourseCode: string | null = null;
    let currentCourseName: string | null = null;
    let currentSection = "A";
    let currentComponent = "LEC";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // 1. Course code
      const courseMatch = line.match(/\b([A-Z]{2,4})\s*(\d{4}[A-Z]?)\b/i);
      if (courseMatch && !IGNORED_WORDS.has(courseMatch[1]!.toUpperCase())) {
        currentCourseCode = `${courseMatch[1]!.toUpperCase()} ${courseMatch[2]!.toUpperCase()}`;
        const nameParts = line.split(/[-–—:]/);
        currentCourseName =
          nameParts.length > 1 ? nameParts.slice(1).join(" ").trim() : currentCourseCode;
        continue;
      }

      // 2. Section and Component
      const compMatch = line.match(/\b(LEC|TUT|LAB|PRA|SEM|DIR)\b/i);
      if (compMatch) currentComponent = compMatch[1]!.toUpperCase();

      const secMatch = line.match(/\b(?:SEC|SECTION|SECT)?\s*([A-Z0-9]{1,4})\b/i);
      if (
        secMatch &&
        !["LEC", "TUT", "LAB", "PRA", "SEM", "DIR"].includes(secMatch[1]!.toUpperCase())
      ) {
        currentSection = secMatch[1]!.toUpperCase();
      }

      // 3. Time range
      const timeMatch = line.match(
        /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|to|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
      );
      if (timeMatch && currentCourseCode) {
        const times = parseTimeRange(timeMatch[0]);
        if (times) {
          let days = parseDays(line);
          if (days.length === 0 && i > 0) days = parseDays(lines[i - 1]!);
          if (days.length === 0 && i + 1 < lines.length) days = parseDays(lines[i + 1]!);
          if (days.length === 0) days = ["MO", "WE", "FR"];

          let locationText = "TBA";
          for (let j = 1; j <= 2; j++) {
            if (i + j < lines.length) {
              const candidate = lines[i + j]!;
              if (
                !candidate.match(
                  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|to|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
                ) &&
                !candidate.match(/\b([A-Z]{2,4})\s*(\d{4})\b/i)
              ) {
                locationText = candidate;
                break;
              }
            }
          }

          const locCandidate =
            extractLocation(locationText, campus) ?? extractLocation(line, campus);
          const location: Meeting["location"] = locCandidate ?? {
            nativeText: locationText || "TBA",
            buildingId: null,
            room: null,
            kind: "tba",
          };

          meetings.push({
            id: `york-text-${meetings.length + 1}`,
            institutionId: adapter.id,
            courseCode: currentCourseCode,
            nativeSection: currentSection,
            nativeComponentType: currentComponent,
            courseName: currentCourseName || currentCourseCode,
            termLabel: `Fall ${year}`,
            days,
            startTime: times.start,
            endTime: times.end,
            startDate,
            endDate,
            location,
            source: { kind: "official-calendar", recordedAt: new Date().toISOString() },
          });
        }
      }
    }
  }

  if (meetings.length === 0) {
    warnings.push(
      "No class meetings could be recognized from the text. Make sure to copy your timetable from the York Registration and Enrolment Module (REM) or Visual Schedule Builder (VSB).",
    );
  }

  return { meetings, warnings };
}

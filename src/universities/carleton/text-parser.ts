import type { CampusSnapshot, Day, InstitutionAdapter, LocationKind, Meeting } from "./model";
import { resolveLocation } from "./meetings";

const BANNER_DAY_MAP: Record<string, Day> = {
  M: "MO",
  T: "TU",
  W: "WE",
  R: "TH",
  F: "FR",
  S: "SA",
  U: "SU",
};

const WORD_DAY_MAP: Record<string, Day> = {
  MONDAY: "MO",
  MON: "MO",
  TUESDAY: "TU",
  TUE: "TU",
  WEDNESDAY: "WE",
  WED: "WE",
  THURSDAY: "TH",
  THU: "TH",
  FRIDAY: "FR",
  FRI: "FR",
  SATURDAY: "SA",
  SAT: "SA",
  SUNDAY: "SU",
  SUN: "SU",
};

const IGNORED_DEPARTMENTS = new Set([
  "FALL",
  "WINT",
  "SUMM",
  "TERM",
  "YEAR",
  "DATE",
  "WEEK",
  "DAYS",
  "TIME",
  "TYPE",
]);

function parseDays(raw: string): Day[] {
  const result: Day[] = [];

  // 1. Check for word days: Monday, Tue, etc.
  const wordRegex =
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRegex.exec(raw)) !== null) {
    const day = WORD_DAY_MAP[wordMatch[1]!.toUpperCase()];
    if (day && !result.includes(day)) {
      result.push(day);
    }
  }
  if (result.length > 0) return result;

  // 2. Check for Banner day tokens as discrete words (e.g. TR, MWF, M, R)
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
    "SU",
  ]);

  while ((tokenMatch = tokenRegex.exec(raw)) !== null) {
    const token = tokenMatch[1]!.toUpperCase();
    if (validBannerTokens.has(token)) {
      for (const char of token) {
        const day = BANNER_DAY_MAP[char];
        if (day && !result.includes(day)) {
          result.push(day);
        }
      }
    }
  }

  return result;
}

function parseTimeToken(token: string): string | null {
  const clean = token.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return null;

  let hour = parseInt(match[1]!, 10);
  const minute = parseInt(match[2]!, 10);
  const ampm = match[3];

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeRange(raw: string): { start: string; end: string } | null {
  const parts = raw.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return null;

  let startStr = parts[0]!.trim();
  const endStr = parts[1]!.trim();

  const endMatch = endStr.toLowerCase().match(/(am|pm)$/);
  if (endMatch && !startStr.toLowerCase().match(/(am|pm)$/)) {
    const endAmPm = endMatch[1]!;
    const startHour = parseInt(startStr.split(":")[0]!, 10);
    if (endAmPm === "pm") {
      const endHour = parseInt(endStr.split(":")[0]!, 10);
      if (startHour === 12 || startHour < endHour) {
        startStr += " pm";
      } else if (startHour >= 8 && startHour <= 11) {
        startStr += " am";
      } else {
        startStr += " pm";
      }
    } else {
      startStr += " am";
    }
  }

  const start = parseTimeToken(startStr);
  const end = parseTimeToken(endStr);

  if (start && end && start < end) {
    return { start, end };
  }
  return null;
}

function extractLocation(str: string, campus: CampusSnapshot): string | null {
  const candidates: Array<{ token: string; buildingId: string }> = [];
  for (const b of campus.buildings) {
    for (const name of [b.name, ...b.aliases]) {
      candidates.push({ token: name, buildingId: b.id });
    }
  }
  candidates.sort((a, b) => b.token.length - a.token.length);

  const clean = str.replace(/[,;]/g, " ");
  for (const { token } of candidates) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b(?:\\s+(?:Room\\s*)?([A-Z0-9-]+))?`, "i");
    const m = clean.match(regex);
    if (m) {
      return m[1] ? `${token} ${m[1]}` : token;
    }
  }

  for (const b of campus.buildings) {
    for (const code of b.nativeCodes) {
      const regex = new RegExp(`\\b${code}\\b\\s*(?:Room\\s*)?([A-Z0-9-]+)`, "i");
      const m = clean.match(regex);
      if (m && m[1]) {
        return `${code} ${m[1]}`;
      }
    }
  }

  return null;
}

export function parseCarletonText(
  text: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): { meetings: Meeting[]; warnings: string[] } {
  const warnings: string[] = [];
  const meetings: Meeting[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { meetings, warnings: ["The pasted schedule text was empty."] };
  }

  let detectedTerm = "Fall";
  const termMatch = text.match(/\b(Fall|Winter|Summer)\s*(\d{4})?\b/i);
  if (termMatch) {
    const t = termMatch[1]!.toLowerCase();
    detectedTerm = t === "winter" ? "Winter" : t === "summer" ? "Summer" : "Fall";
  }

  const startDate =
    detectedTerm === "Winter"
      ? "2027-01-08"
      : detectedTerm === "Summer"
        ? "2027-05-05"
        : "2026-09-04";
  const endDate =
    detectedTerm === "Winter"
      ? "2027-04-12"
      : detectedTerm === "Summer"
        ? "2027-08-15"
        : "2026-12-08";

  // Strategy 1: Tab-separated or single-line tabular rows (Concise Student Schedule)
  for (const line of lines) {
    const courseMatches = [...line.matchAll(/\b([A-Z]{4})\s*(\d{4})\b/gi)];
    const validMatch = courseMatches.find((m) => !IGNORED_DEPARTMENTS.has(m[1]!.toUpperCase()));
    if (!validMatch) continue;

    const courseCode = `${validMatch[1]!.toUpperCase()} ${validMatch[2]!}`;
    const timeMatch = line.match(
      /(\d{1,2}:\d{2}\s*(?:am|pm)?\s*[-–—]\s*\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    );

    if (timeMatch) {
      const times = parseTimeRange(timeMatch[1]!);
      if (times) {
        const beforeTime = line.slice(0, timeMatch.index!).trim();
        const afterTime = line.slice(timeMatch.index! + timeMatch[0].length).trim();

        let days: Day[] = [];
        const daysTokenMatch = beforeTime.match(
          /\b(MWF|TR|MW|M|T|W|R|F|S|U|Tuesday,\s*Thursday|Monday,\s*Wednesday,\s*Friday)\b/i,
        );
        if (daysTokenMatch) {
          days = parseDays(daysTokenMatch[1]!);
        } else {
          const afterDaysMatch = afterTime.match(
            /^\s*(MWF|TR|MW|M|T|W|R|F|S|U|Tuesday|Thursday|Monday|Wednesday|Friday)\b/i,
          );
          if (afterDaysMatch) {
            days = parseDays(afterDaysMatch[1]!);
          }
        }

        // Section & Component
        const secMatch = beforeTime.match(/\b([A-Z]\d?)\b/i);
        const section = secMatch ? secMatch[1]!.toUpperCase() : "A";

        const compMatch = line.match(
          /\b(LEC|TUT|LAB|SEM|PRC|Lecture|Tutorial|Laboratory|Seminar)\b/i,
        );
        const componentType = compMatch ? compMatch[1]!.toUpperCase().slice(0, 3) : "LEC";

        const locationCandidate = extractLocation(afterTime, campus);
        const locationText = locationCandidate || afterTime.trim() || "TBA";
        const kind: LocationKind = /online|web|asynchronous/i.test(locationText)
          ? "online"
          : locationText === "TBA"
            ? "tba"
            : "physical";
        const location = resolveLocation(locationText, kind, campus);

        if (days.length > 0) {
          meetings.push({
            id: crypto.randomUUID(),
            institutionId: adapter.id,
            courseCode,
            courseName: courseCode,
            nativeSection: section,
            nativeComponentType: componentType,
            termLabel: `${detectedTerm} ${startDate.slice(0, 4)}`,
            days,
            startTime: times.start,
            endTime: times.end,
            startDate,
            endDate,
            location,
            source: {
              kind: "student-entry",
              recordedAt: new Date().toISOString(),
            },
          });
        }
      }
    }
  }

  // Strategy 2: Multi-line blocks (Detail Schedule from Carleton Central)
  if (meetings.length === 0) {
    let currentCourseCode: string | null = null;
    let currentCourseName: string | null = null;
    let currentSection = "A";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Exclude lines like "Associated Term: Fall 2026"
      if (/term|date|range|scheduled|registration|status|instructor/i.test(line)) {
        // Continue but do not match course code if line is metadata
        if (line.includes("Associated Term") || line.includes("Date Range")) continue;
      }

      const courseMatches = [...line.matchAll(/\b([A-Z]{4})\s*(\d{4})\b/gi)];
      const validMatch = courseMatches.find((m) => !IGNORED_DEPARTMENTS.has(m[1]!.toUpperCase()));

      if (validMatch && (line.includes("-") || line.length < 50)) {
        currentCourseCode = `${validMatch[1]!.toUpperCase()} ${validMatch[2]!}`;
        const parts = line.split(/[-–—]/);
        currentCourseName = parts.length > 1 ? parts.slice(1).join("-").trim() : currentCourseCode;
        continue;
      }

      const secMatch = line.match(/\b(?:Section|Sec)\s*:\s*([A-Z0-9]+)\b/i);
      if (secMatch) {
        currentSection = secMatch[1]!.toUpperCase();
        continue;
      }

      const timeMatch = line.match(
        /(\d{1,2}:\d{2}\s*(?:am|pm)?\s*[-–—]\s*\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
      );
      if (timeMatch && currentCourseCode) {
        const times = parseTimeRange(timeMatch[1]!);
        if (times) {
          let days = parseDays(line);
          if (days.length === 0 && i + 1 < lines.length) {
            days = parseDays(lines[i + 1]!);
          }
          if (days.length === 0 && i > 0) {
            days = parseDays(lines[i - 1]!);
          }
          if (days.length === 0) days = ["MO", "WE"];

          // Location search in current line or subsequent lines
          let locText = extractLocation(line, campus);
          if (!locText && i + 1 < lines.length) {
            locText = extractLocation(lines[i + 1]!, campus);
          }
          if (!locText && i + 2 < lines.length) {
            locText = extractLocation(lines[i + 2]!, campus);
          }

          const locationText = locText || "TBA";
          const kind: LocationKind = /online|web/i.test(locationText)
            ? "online"
            : locationText === "TBA"
              ? "tba"
              : "physical";
          const location = resolveLocation(locationText, kind, campus);

          meetings.push({
            id: crypto.randomUUID(),
            institutionId: adapter.id,
            courseCode: currentCourseCode,
            courseName: currentCourseName ?? currentCourseCode,
            nativeSection: currentSection,
            nativeComponentType: "LEC",
            termLabel: `${detectedTerm} ${startDate.slice(0, 4)}`,
            days,
            startTime: times.start,
            endTime: times.end,
            startDate,
            endDate,
            location,
            source: {
              kind: "student-entry",
              recordedAt: new Date().toISOString(),
            },
          });
        }
      }
    }
  }

  if (meetings.length === 0) {
    warnings.push(
      "No class meetings could be recognized from the text. Make sure to copy the schedule table from Carleton Central.",
    );
  }

  return { meetings, warnings };
}

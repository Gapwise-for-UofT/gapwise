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
      } else {
        for (const char of token) {
          const d = BANNER_DAY_MAP[char];
          if (d && !result.includes(d)) result.push(d);
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

  let hour = Number(match[1]);
  const min = match[2];
  const ampm = match[3];

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${min}`;
}

function parseTimeRange(raw: string): { start: string; end: string } | null {
  const match = raw.match(
    /(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
  );
  if (!match) return null;

  let startStr = match[1]!.trim();
  const endStr = match[2]!.trim();

  if (!/(am|pm)$/i.test(startStr) && /(am|pm)$/i.test(endStr)) {
    const endAmPm = endStr.slice(-2).toLowerCase();
    const startHour = Number(startStr.split(":")[0]);
    const endHour = Number(endStr.split(":")[0]);
    if (endAmPm === "pm") {
      if (
        startHour === 12 ||
        (startHour < 12 && startHour >= 8 && endHour < 12 && startHour <= endHour)
      ) {
        startStr += "am";
      } else {
        startStr += "pm";
      }
    } else {
      startStr += "am";
    }
  }

  const start = parseTimeToken(startStr);
  const end = parseTimeToken(endStr);
  if (start && end) return { start, end };
  return null;
}

function extractLocation(str: string, campus: CampusSnapshot): string | null {
  const clean = str.replace(/[,;]/g, " ");

  // 1. Try matching full building names or aliases
  const candidates: Array<{ token: string; buildingId: string }> = [];
  for (const b of campus.buildings) {
    for (const name of [b.name, ...b.aliases]) {
      candidates.push({ token: name, buildingId: b.id });
    }
  }
  candidates.sort((a, b) => b.token.length - a.token.length);

  for (const { token } of candidates) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b(?:\\s+(?:Room\\s*)?([A-Z0-9-]+))?`, "i");
    const m = clean.match(regex);
    if (m) {
      return m[1] ? `${token} ${m[1]}` : token;
    }
  }

  // 2. Try matching building native code + room
  for (const b of campus.buildings) {
    for (const code of b.nativeCodes) {
      const regex = new RegExp(`\\b${code}\\b\\s*(?:Room\\s*)?([A-Z0-9-]+)`, "i");
      const m = clean.match(regex);
      if (m && m[1]) {
        return `${code} ${m[1]}`;
      }
    }
  }

  // 3. Fallback: building code alone only if capitalized exactly
  for (const b of campus.buildings) {
    for (const code of b.nativeCodes) {
      if (code.length >= 2 && clean.includes(code)) {
        return code;
      }
    }
  }

  return null;
}

export function parseLaurierText(
  rawText: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): { meetings: Meeting[]; warnings: string[] } {
  const warnings: string[] = [];
  const meetings: Meeting[] = [];
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { meetings, warnings: ["The pasted schedule text was empty."] };
  }

  const today = new Date();
  const year = today.getFullYear();
  const startDate = `${year}-09-08`;
  const endDate = `${year}-12-08`;

  // Strategy 1: Tabular single-line format (LORIS Concise Student Schedule)
  for (const line of lines) {
    const courseMatches = [...line.matchAll(/\b([A-Z]{2,4})\s*(\d{3}[A-Z]?)\b/gi)];
    const validMatch = courseMatches.find((m) => !IGNORED_WORDS.has(m[1]!.toUpperCase()));
    if (!validMatch) continue;

    const timeMatch = line.match(
      /(\d{1,2}:\d{2}\s*(?:am|pm)?\s*[-–—to]+\s*\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    );
    if (timeMatch) {
      const times = parseTimeRange(timeMatch[1]!);
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
        const secMatch = betweenCourseAndTime.match(/\b([A-Z]\d?|\d{1,3})\b/);
        const section = secMatch ? secMatch[1]! : "A";

        const compMatch = line.match(/\b(LEC|TUT|LAB|PRA|SEM)\b/i);
        const component = compMatch ? compMatch[1]!.toUpperCase() : "LEC";

        const locCandidate = extractLocation(afterTime, campus) ?? extractLocation(line, campus);
        const locationText = locCandidate ?? "TBA";
        const kind: LocationKind = /online|web|virtual/i.test(locationText)
          ? "online"
          : locationText === "TBA"
            ? "tba"
            : "physical";
        const location = resolveLocation(locationText, kind, campus);

        const id =
          `${adapter.id}-${courseCode.replace(/\s+/g, "-")}-${section}-${days.join("")}-${times.start}`.toLowerCase();
        meetings.push({
          id,
          institutionId: adapter.id,
          courseCode,
          courseName: courseCode,
          nativeSection: section,
          nativeComponentType: component,
          termLabel: `Fall ${year}`,
          days,
          startTime: times.start,
          endTime: times.end,
          startDate,
          endDate,
          location,
          source: { kind: "student-entry", recordedAt: new Date().toISOString() },
        });
      }
    }
  }

  // Strategy 2: Multi-line block format (LORIS Detail Schedule)
  if (meetings.length === 0) {
    let currentCourseCode: string | null = null;
    let currentCourseName: string | null = null;
    let currentSection = "A";
    let currentComponent = "LEC";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // 1. Course code
      const courseMatch = line.match(/\b([A-Z]{2,4})\s*(\d{3}[A-Z]?)\b/i);
      if (courseMatch && !IGNORED_WORDS.has(courseMatch[1]!.toUpperCase())) {
        currentCourseCode = `${courseMatch[1]!.toUpperCase()} ${courseMatch[2]!.toUpperCase()}`;
        const nameParts = line.split(/[-–—:]/);
        currentCourseName =
          nameParts.length > 1 ? nameParts.slice(1).join(" ").trim() : currentCourseCode;

        const compMatch = line.match(/\b(LEC|TUT|LAB|SEM)\b/i);
        if (compMatch) currentComponent = compMatch[1]!.toUpperCase();
        continue;
      }

      // 2. Section
      const secMatch = line.match(/\b(?:Section|Sec)\s*[:#]?\s*([A-Z0-9]{1,3})\b/i);
      if (secMatch) {
        currentSection = secMatch[1]!.toUpperCase();
      }

      // 3. Time range
      const timeMatch = line.match(
        /(\d{1,2}:\d{2}\s*(?:am|pm)?\s*[-–—to]+\s*\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
      );
      if (timeMatch && currentCourseCode) {
        const times = parseTimeRange(timeMatch[1]!);
        if (times) {
          let days = parseDays(line);
          if (days.length === 0 && i > 0) days = parseDays(lines[i - 1]!);
          if (days.length === 0 && i + 1 < lines.length) days = parseDays(lines[i + 1]!);
          if (days.length === 0) days = ["MO", "WE", "FR"];

          // Search next 2 lines for location
          let locationText = "TBA";
          for (let offset = 1; offset <= 2; offset++) {
            if (i + offset < lines.length) {
              const loc = extractLocation(lines[i + offset]!, campus);
              if (loc) {
                locationText = loc;
                break;
              }
            }
          }
          if (locationText === "TBA") {
            const loc = extractLocation(line, campus);
            if (loc) locationText = loc;
          }

          const kind: LocationKind = /online|web|virtual/i.test(locationText)
            ? "online"
            : locationText === "TBA"
              ? "tba"
              : "physical";
          const location = resolveLocation(locationText, kind, campus);

          const id =
            `${adapter.id}-${currentCourseCode.replace(/\s+/g, "-")}-${currentSection}-${days.join("")}-${times.start}`.toLowerCase();
          meetings.push({
            id,
            institutionId: adapter.id,
            courseCode: currentCourseCode,
            courseName: currentCourseName ?? currentCourseCode,
            nativeSection: currentSection,
            nativeComponentType: currentComponent,
            termLabel: `Fall ${year}`,
            days,
            startTime: times.start,
            endTime: times.end,
            startDate,
            endDate,
            location,
            source: { kind: "student-entry", recordedAt: new Date().toISOString() },
          });
        }
      }
    }
  }

  if (meetings.length === 0) {
    warnings.push(
      "No class meetings could be recognized from the text. Make sure to copy your timetable from LORIS.",
    );
  }

  return { meetings, warnings };
}

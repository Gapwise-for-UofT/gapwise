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

interface ParsedBlock {
  courseCode: string;
  courseName?: string;
  section: string;
  component: string;
  days: Day[];
  startTime: string;
  endTime: string;
  startDate?: string;
  endDate?: string;
  locationText: string;
  termLabel?: string;
}

function parseDays(raw: string): Day[] {
  const upper = raw.trim().toUpperCase();
  const days: Day[] = [];
  const words = upper.split(/[\s,]+/);
  for (const w of words) {
    if (WORD_DAY_MAP[w] && !days.includes(WORD_DAY_MAP[w]!)) {
      days.push(WORD_DAY_MAP[w]!);
    }
  }
  if (days.length > 0) return days;

  let i = 0;
  while (i < upper.length) {
    if (i + 1 < upper.length && upper.slice(i, i + 2) === "TH") {
      if (!days.includes("TH")) days.push("TH");
      i += 2;
    } else {
      const c = upper[i]!;
      if (BANNER_DAY_MAP[c] && !days.includes(BANNER_DAY_MAP[c]!)) {
        days.push(BANNER_DAY_MAP[c]!);
      }
      i++;
    }
  }
  return days;
}

function to24Hour(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

export function parseGuelphText(
  text: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): { meetings: Meeting[]; warnings: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: ParsedBlock[] = [];
  const warnings: string[] = [];

  let currentCode: string | null = null;
  let currentName: string | null = null;
  let currentSection = "01";
  let currentComponent = "LEC";
  let currentTerm = "Fall 2026";

  const timeRangeRegex =
    /(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;
  const courseCodeRegex = /\b([A-Z]{2,6})\*?\s*(\d{4})\b/i;

  for (const line of lines) {
    if (/Fall\s*\d{4}/i.test(line)) {
      currentTerm = line.match(/Fall\s*\d{4}/i)![0];
      continue;
    }
    if (/Winter\s*\d{4}/i.test(line)) {
      currentTerm = line.match(/Winter\s*\d{4}/i)![0];
      continue;
    }

    const codeMatch = line.match(courseCodeRegex);
    if (codeMatch) {
      const rawCode = `${codeMatch[1]} ${codeMatch[2]}`;
      const parsed = adapter.parseCourseCode(rawCode);
      if (parsed) {
        currentCode = parsed;
        const remainder = line
          .slice(codeMatch.index! + codeMatch[0].length)
          .replace(/^[\s-–—:]+/, "")
          .trim();
        if (remainder && !timeRangeRegex.test(remainder)) {
          currentName = remainder;
        }
      }
    }

    const compMatch = line.match(/\b(LEC|TUT|LAB|PRA|SEM|SEC)\s*(\d{1,3}|[A-Z]\d{0,2})?\b/i);
    if (compMatch) {
      currentComponent = compMatch[1]!.toUpperCase();
      if (compMatch[2]) currentSection = compMatch[2];
    }

    const timeMatch = line.match(timeRangeRegex);
    if (timeMatch && currentCode) {
      const start24 = to24Hour(timeMatch[1]!);
      const end24 = to24Hour(timeMatch[2]!);
      if (start24 && end24) {
        const beforeTime = line.slice(0, timeMatch.index!).trim();
        const afterTime = line.slice(timeMatch.index! + timeMatch[0].length).trim();
        let days = parseDays(beforeTime);
        if (days.length === 0) days = parseDays(afterTime);
        if (days.length === 0) days = ["MO", "WE", "FR"];

        let locText = afterTime.replace(/^[,\s-]+/, "").trim();
        if (!locText) locText = "TBA";

        blocks.push({
          courseCode: currentCode,
          courseName: currentName ?? currentCode,
          section: currentSection,
          component: currentComponent,
          days,
          startTime: start24,
          endTime: end24,
          locationText: locText,
          termLabel: currentTerm,
        });
      }
    }
  }

  const meetings: Meeting[] = [];
  for (const b of blocks) {
    let locKind: LocationKind = "physical";
    if (/tba|online|virtual|remote/i.test(b.locationText)) {
      locKind = /online|virtual/i.test(b.locationText) ? "online" : "tba";
    }
    const resolved = resolveLocation(b.locationText, locKind, campus);

    const isWinter = b.termLabel?.startsWith("Winter");
    const startDate = isWinter ? "2027-01-06" : "2026-09-08";
    const endDate = isWinter ? "2027-04-09" : "2026-12-08";

    meetings.push({
      id: `txt-${Math.random().toString(36).slice(2)}`,
      institutionId: adapter.id,
      courseCode: b.courseCode,
      nativeSection: b.section,
      nativeComponentType: b.component,
      courseName: b.courseName || b.courseCode,
      termLabel: b.termLabel ?? "Fall 2026",
      days: b.days,
      startTime: b.startTime,
      endTime: b.endTime,
      startDate,
      endDate,
      location: resolved,
      source: { kind: "student-entry", recordedAt: new Date().toISOString() },
    });
  }

  return { meetings, warnings };
}

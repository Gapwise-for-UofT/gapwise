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

export function parseIcs(
  icsText: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): ParsedIcsResult {
  const lines = icsText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfolded.length > 0) {
        unfolded[unfolded.length - 1] += line.slice(1);
      }
    } else {
      unfolded.push(line);
    }
  }

  const events: Record<string, string>[] = [];
  let currentEvent: Record<string, string> | null = null;

  for (const line of unfolded) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (trimmed === "END:VEVENT") {
      if (currentEvent) events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        const keyPart = trimmed.slice(0, colonIdx);
        const val = trimmed.slice(colonIdx + 1);
        const propName = keyPart.split(";")[0]?.toUpperCase() ?? "";
        currentEvent[propName] = val;
        if (keyPart.includes(";")) {
          currentEvent[`${propName}_FULL`] = trimmed;
        }
      }
    }
  }

  const meetings: Meeting[] = [];
  const warnings: string[] = [];

  for (const ev of events) {
    const summary = (ev["SUMMARY"] ?? "").trim();
    if (!summary) continue;

    const dtstart = parseIcsDate(ev["DTSTART_FULL"] ?? ev["DTSTART"] ?? "");
    const dtend = parseIcsDate(ev["DTEND_FULL"] ?? ev["DTEND"] ?? "");
    if (!dtstart || !dtend) {
      warnings.push(`Skipping event "${summary}" due to missing or invalid dates.`);
      continue;
    }

    const startTime = formatTime(dtstart);
    const endTime = formatTime(dtend);
    const startDate = formatDate(dtstart);
    const endDate = formatDate(dtend);

    let days: Meeting["days"] = [];
    const rrule = ev["RRULE"] ?? "";
    if (rrule.includes("BYDAY=")) {
      const bydayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
      if (bydayMatch) {
        days = bydayMatch[1]!
          .split(",")
          .map((d) => BYDAY_MAP[d])
          .filter((d): d is Meeting["days"][number] => Boolean(d));
      }
    }
    if (days.length === 0) {
      const dayIndex = dtstart.getUTCDay();
      const fallbackDays: Meeting["days"][number][] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const d = fallbackDays[dayIndex];
      if (d) days = [d];
    }

    let courseCode = summary;
    let nativeComponentType = "LEC";
    let nativeSection = "001";
    let courseName = summary;

    const codeMatch = summary.match(/^([A-Z]{2,8}\s*\d[A-Z0-9]{2,4})/i);
    if (codeMatch) {
      courseCode = adapter.parseCourseCode(codeMatch[1]!) ?? codeMatch[1]!;
      const rest = summary.slice(codeMatch[0].length).trim();
      const compMatch = rest.match(/\b(LEC|TUT|LAB|PRA|SEM|SEC|DIS)\b/i);
      if (compMatch) {
        nativeComponentType = compMatch[1]!.toUpperCase();
      }
      const secMatch = rest.match(/\b(\d{3}|[A-Z]\d{2})\b/);
      if (secMatch) {
        nativeSection = secMatch[1]!;
      }
      courseName = rest.replace(/^(?:-|–|—|:)\s*/, "").trim() || courseCode;
    }

    const rawLoc = (ev["LOCATION"] ?? "").trim();
    let locationKind: LocationKind = "physical";
    if (!rawLoc || /TBA|online|virtual|remote/i.test(rawLoc)) {
      locationKind = /online|virtual|remote/i.test(rawLoc) ? "online" : "tba";
    }

    const resolved = resolveLocation(rawLoc, locationKind, campus);

    const termLabel =
      dtstart.getUTCMonth() >= 8
        ? `Fall ${dtstart.getUTCFullYear()}`
        : dtstart.getUTCMonth() >= 4
          ? `Summer ${dtstart.getUTCFullYear()}`
          : `Winter ${dtstart.getUTCFullYear()}`;

    meetings.push({
      id: `ics-${ev["UID"] ?? Math.random().toString(36).slice(2)}`,
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
      location: resolved,
      source: { kind: "student-entry", recordedAt: new Date().toISOString() },
    });
  }

  return { meetings, warnings };
}

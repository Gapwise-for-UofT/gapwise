import ICAL from "ical.js";
import type { CampusSnapshot, Day, InstitutionAdapter, Meeting } from "./model";
import { resolveLocation } from "./meetings";

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

  // Try matching "[DEPT] [1234][SECTION?]" or "[DEPT] [1234] [SECTION?]"
  // e.g. "COMP 1405 A LEC - Intro to CS", "BUSI 1004A Financial Accounting", "MATH 1007 TUT A1"
  const courseMatch = cleaned.match(/\b([A-Z]{4})\s*(\d{4})([A-Z0-9]*)\b/i);
  const courseCode = courseMatch
    ? `${courseMatch[1]!.toUpperCase()} ${courseMatch[2]!}`
    : cleaned || "UNKNOWN";
  let section = courseMatch && courseMatch[3] ? courseMatch[3].toUpperCase() : "";

  // Look for component type in summary
  const compMatch = cleaned.match(/\b(LEC|TUT|LAB|SEM|GRP|WKS|PRC|REC|DIS)\b/i);
  const nativeComponentType = compMatch ? compMatch[1]!.toUpperCase() : "CLASS";

  // Look for section if not found in course code suffix
  if (!section) {
    const remainder = courseMatch ? cleaned.slice(courseMatch.index! + courseMatch[0].length) : "";
    const secMatch = remainder.match(/^\s*(?:(?:SEC|SECTION|SECT)\s+)?([A-Z]\d?)\b/i);
    if (
      secMatch &&
      secMatch[1] &&
      !["LEC", "TUT", "LAB", "SEM", "GRP", "WKS", "PRC"].includes(secMatch[1].toUpperCase())
    ) {
      section = secMatch[1].toUpperCase();
    }
  }

  // Look for course name / title
  let courseName = "";
  const parts = cleaned.split(/[-–—:]/);
  if (parts.length > 1) {
    courseName = parts.slice(1).join(" ").trim();
  } else if (courseMatch) {
    courseName = cleaned
      .slice(courseMatch.index! + courseMatch[0].length)
      .replace(/^\s*(?:(?:SEC|SECTION|SECT)\s+)?[A-Z]\d?\b/i, "")
      .replace(/^\s*(?:\(?\b(?:LEC|TUT|LAB|SEM|GRP|WKS|PRC|REC|DIS)\b\)?)\s*/i, "")
      .trim();
  }

  return {
    courseCode,
    nativeSection: section || "Unspecified",
    nativeComponentType,
    courseName,
  };
}

export function parseIcs(
  icsContent: string,
  campus: CampusSnapshot,
  adapter: InstitutionAdapter,
): { meetings: Meeting[]; warnings: string[] } {
  const meetings: Meeting[] = [];
  const warnings: string[] = [];

  if (!icsContent.trim()) {
    return { meetings, warnings: ["The provided calendar file was empty."] };
  }

  let jcalData: unknown;
  try {
    jcalData = ICAL.parse(icsContent);
  } catch (cause) {
    return {
      meetings,
      warnings: [
        `Could not parse iCalendar data: ${cause instanceof Error ? cause.message : "Invalid calendar structure"}`,
      ],
    };
  }

  try {
    const vcalendar = new ICAL.Component(jcalData as unknown[]);
    const vevents = vcalendar.getAllSubcomponents("vevent");

    if (vevents.length === 0) {
      warnings.push("No event records were found in the uploaded calendar.");
      return { meetings, warnings };
    }

    const seenKeys = new Set<string>();
    const overriddenUids = new Set(
      vevents
        .filter((component) => component.hasProperty("recurrence-id"))
        .map((component) => String(component.getFirstPropertyValue("uid") ?? "")),
    );

    for (const vevent of vevents) {
      const summary = String(vevent.getFirstPropertyValue("summary") ?? "");
      try {
        if (vevent.hasProperty("recurrence-id")) continue;
        if (!summary.trim()) continue;
        if (String(vevent.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED")
          continue;
        if (!/\b[A-Z]{4}\s*\d{4}/i.test(summary)) {
          warnings.push(`Skipped “${summary}”: no recognizable Carleton course code.`);
          continue;
        }
        const event = new ICAL.Event(vevent);
        if (
          overriddenUids.has(String(vevent.getFirstPropertyValue("uid") ?? "")) ||
          vevent.hasProperty("exdate") ||
          vevent.hasProperty("exrule") ||
          vevent.hasProperty("rdate")
        ) {
          warnings.push(
            `Skipped “${summary}”: recurrence exceptions or added dates cannot be represented in the weekly timetable.`,
          );
          continue;
        }

        const { courseCode, nativeSection, nativeComponentType, courseName } =
          parseSummary(summary);
        const normalizedCode = adapter.parseCourseCode(courseCode);
        if (!normalizedCode) {
          warnings.push(`Skipped “${summary}”: invalid Carleton course code.`);
          continue;
        }

        // Dates & Times
        const icalStart = event.startDate;
        const icalEnd = event.endDate;
        if (!icalStart || !icalEnd) {
          warnings.push(`Skipped “${summary}”: a start or end time is missing.`);
          continue;
        }

        const rruleProp = vevent.getFirstPropertyValue("rrule") as {
          freq?: string;
          until?: unknown;
          count?: number;
          interval?: number;
          parts?: Record<string, unknown>;
        } | null;
        if (!rruleProp || rruleProp.freq !== "WEEKLY") {
          warnings.push(
            `Skipped “${summary}”: only weekly recurring calendar events can be represented as a weekly timetable.`,
          );
          continue;
        }
        if (
          (!rruleProp.until && !rruleProp.count) ||
          (rruleProp.interval ?? 1) !== 1 ||
          Object.keys(rruleProp.parts ?? {}).some((part) => part !== "BYDAY")
        ) {
          warnings.push(
            `Skipped “${summary}”: the recurrence has no finite weekly date range or uses an unsupported pattern.`,
          );
          continue;
        }

        const expansion = event.iterator();
        const occurrences: Array<{
          start: ReturnType<typeof torontoParts>;
          end: ReturnType<typeof torontoParts>;
        }> = [];
        let next = expansion.next();
        while (next && occurrences.length < 2000) {
          const details = event.getOccurrenceDetails(next);
          occurrences.push({
            start: torontoParts(details.startDate),
            end: torontoParts(details.endDate),
          });
          next = expansion.next();
        }
        if (next || occurrences.length === 0) {
          warnings.push(
            `Skipped “${summary}”: recurrence is empty or exceeds the supported 2,000 occurrences.`,
          );
          continue;
        }
        const first = occurrences[0]!;
        const last = occurrences.at(-1)!;
        const startTime = `${pad2(first.start.hour)}:${pad2(first.start.minute)}`;
        const endTime = `${pad2(first.end.hour)}:${pad2(first.end.minute)}`;
        const startDate = `${first.start.year}-${pad2(first.start.month)}-${pad2(first.start.day)}`;
        const endDate = `${last.start.year}-${pad2(last.start.month)}-${pad2(last.start.day)}`;
        const days = [
          ...new Set(
            occurrences.map(
              ({ start }) =>
                ICAL_DAY_INDEX[
                  new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay()
                ]!,
            ),
          ),
        ];
        if (
          occurrences.some(
            ({ start, end }) =>
              `${pad2(start.hour)}:${pad2(start.minute)}` !== startTime ||
              `${pad2(end.hour)}:${pad2(end.minute)}` !== endTime ||
              `${start.year}-${pad2(start.month)}-${pad2(start.day)}` !==
                `${end.year}-${pad2(end.month)}-${pad2(end.day)}`,
          ) ||
          endTime <= startTime
        ) {
          warnings.push(
            `Skipped “${summary}”: its local time varies or crosses midnight and cannot fit a single weekly block.`,
          );
          continue;
        }

        // Term
        const month = first.start.month;
        const termLabel =
          month >= 9
            ? `Fall ${first.start.year}`
            : month <= 4
              ? `Winter ${first.start.year}`
              : `Summer ${first.start.year}`;

        // Location
        const rawLocation = (event.location || "").trim();
        let kind: Meeting["location"]["kind"] = "physical";
        if (!rawLocation || /\b(tba|to be announced)\b/i.test(rawLocation)) {
          kind = "tba";
        } else if (/\b(online|zoom|remote|web|asynchronous|brightspace)\b/i.test(rawLocation)) {
          kind = "online";
        }

        const location = resolveLocation(rawLocation, kind, campus);
        if (kind === "physical" && !location.buildingId) {
          warnings.push(
            `Location "${rawLocation}" for ${normalizedCode} could not be linked to a known Carleton campus building.`,
          );
        }

        // Deduplicate recurring series
        const dedupeKey = `${normalizedCode}|${nativeSection}|${nativeComponentType}|${days.sort().join(",")}|${startTime}|${endTime}|${startDate}|${endDate}|${location.nativeText}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        meetings.push({
          id: crypto.randomUUID(),
          institutionId: adapter.id,
          courseCode: normalizedCode,
          nativeSection,
          nativeComponentType,
          courseName: courseName || `${normalizedCode} ${nativeComponentType}`,
          termLabel,
          days,
          startTime,
          endTime,
          startDate,
          endDate,
          location,
          source: { kind: "ics-import", recordedAt: new Date().toISOString() },
        });
      } catch (error) {
        warnings.push(
          `Skipped “${summary}”: ${error instanceof Error ? error.message : "invalid event data"}`,
        );
      }
    }
  } catch (error) {
    warnings.push(
      `Warning during calendar extraction: ${error instanceof Error ? error.message : "Unknown issue"}`,
    );
  }

  return { meetings, warnings };
}

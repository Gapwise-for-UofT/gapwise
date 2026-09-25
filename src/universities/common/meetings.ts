import { DAYS, type CampusSnapshot, type Day, type Meeting } from "./model";
import type { InstitutionAdapter } from "./model";

export type Draft = Omit<Meeting, "id" | "institutionId" | "source">;
const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateDraft(draft: Draft, adapter: InstitutionAdapter): string[] {
  const errors: string[] = [];
  if (!adapter.parseCourseCode(draft.courseCode))
    errors.push(`Enter a valid course code for ${adapter.name}.`);
  if (!draft.nativeSection.trim()) errors.push("Enter the native section identifier.");
  if (!draft.nativeComponentType.trim()) errors.push("Enter the component type.");
  if (!draft.termLabel.trim()) errors.push("Enter the term or session.");
  if (!draft.days.length || draft.days.some((d) => !DAYS.includes(d)))
    errors.push("Choose at least one meeting day.");
  if (
    !timeFormat.test(draft.startTime) ||
    !timeFormat.test(draft.endTime) ||
    draft.endTime <= draft.startTime
  )
    errors.push("Enter a valid start and end time.");
  if (
    !dateFormat.test(draft.startDate) ||
    !dateFormat.test(draft.endDate) ||
    Number.isNaN(Date.parse(draft.startDate)) ||
    Number.isNaN(Date.parse(draft.endDate)) ||
    draft.endDate < draft.startDate
  )
    errors.push("Enter a valid meeting date range.");
  if (draft.location.kind === "physical" && !draft.location.nativeText.trim())
    errors.push("Enter the location exactly as shown, or choose TBA.");
  return errors;
}

export function createMeeting(
  draft: Draft,
  adapter: InstitutionAdapter,
  campus: CampusSnapshot,
  now = new Date(),
): Meeting {
  const errors = validateDraft(draft, adapter);
  if (errors.length) throw new Error(errors.join(" "));
  const location = resolveLocation(draft.location.nativeText, draft.location.kind, campus);
  return {
    ...draft,
    id: crypto.randomUUID(),
    institutionId: adapter.id,
    courseCode: adapter.parseCourseCode(draft.courseCode)!,
    nativeSection: draft.nativeSection.trim(),
    nativeComponentType: draft.nativeComponentType.trim(),
    termLabel: draft.termLabel.trim(),
    location,
    source: { kind: "student-entry", recordedAt: now.toISOString() },
  };
}

export function updateMeeting(
  id: string,
  draft: Draft,
  adapter: InstitutionAdapter,
  campus: CampusSnapshot,
  recordedAt?: string,
): Meeting {
  const errors = validateDraft(draft, adapter);
  if (errors.length) throw new Error(errors.join(" "));
  const location = resolveLocation(draft.location.nativeText, draft.location.kind, campus);
  return {
    ...draft,
    id,
    institutionId: adapter.id,
    courseCode: adapter.parseCourseCode(draft.courseCode)!,
    nativeSection: draft.nativeSection.trim(),
    nativeComponentType: draft.nativeComponentType.trim(),
    termLabel: draft.termLabel.trim(),
    location,
    source: { kind: "student-entry", recordedAt: recordedAt ?? new Date().toISOString() },
  };
}

const resolvedLocationCache = new Map<string, Meeting["location"]>();

export function resolveLocation(
  nativeText: string,
  kind: Meeting["location"]["kind"],
  campus: CampusSnapshot,
): Meeting["location"] {
  const text = nativeText.trim();
  if (kind !== "physical") return { kind, nativeText: text, buildingId: null, room: null };

  const cacheKey = `${campus.campus.id}:${text}`;
  const cached = resolvedLocationCache.get(cacheKey);
  if (cached) return cached;

  const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const remainderFor = (alias: string, isCode: boolean): string | null => {
    if (fold(text) === fold(alias)) return "";
    if (fold(text.slice(0, alias.length)) !== fold(alias)) return null;
    const remainder = text.slice(alias.length);
    if (/^[\s,:#-]/.test(remainder) || (isCode && /^\d/.test(remainder))) {
      return remainder
        .replace(/^[\s,:#-]+/, "")
        .replace(/^room\s*/i, "")
        .trim();
    }
    return null;
  };
  const matches = campus.buildings.filter((building) =>
    [...building.nativeCodes, building.name, ...building.aliases].some(
      (alias) => remainderFor(alias, building.nativeCodes.includes(alias)) !== null,
    ),
  );
  if (matches.length !== 1) {
    const unmappedResult = { kind, nativeText: text, buildingId: null, room: null };
    resolvedLocationCache.set(cacheKey, unmappedResult);
    return unmappedResult;
  }
  const building = matches[0]!;
  const alias = [...building.nativeCodes, building.name, ...building.aliases]
    .sort((a, b) => b.length - a.length)
    .find((a) => remainderFor(a, building.nativeCodes.includes(a)) !== null)!;
  const result: Meeting["location"] = {
    kind,
    nativeText: text,
    buildingId: building.id,
    room: remainderFor(alias, building.nativeCodes.includes(alias)) || null,
  };
  resolvedLocationCache.set(cacheKey, result);
  return result;
}

export function sortedForDay(meetings: Meeting[], day: Day): Meeting[] {
  return meetings
    .filter((m) => m.days.includes(day))
    .sort(
      (a, b) => a.startTime.localeCompare(b.startTime) || a.courseCode.localeCompare(b.courseCode),
    );
}

export function hasConflict(a: Meeting, b: Meeting, day: Day): boolean {
  if (a.id === b.id) return false;
  if (!a.days.includes(day) || !b.days.includes(day)) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function findConflictsForMeeting(
  meeting: Meeting,
  day: Day,
  meetings: Meeting[],
): Meeting[] {
  return meetings.filter((other) => hasConflict(meeting, other, day));
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
}

export function formatGap(minutes: number): string {
  if (minutes < 0) return "Time conflict";
  if (minutes === 0) return "No gap (back-to-back)";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min gap`;
  if (m === 0) return `${h} hr gap`;
  return `${h} hr ${m} min gap`;
}

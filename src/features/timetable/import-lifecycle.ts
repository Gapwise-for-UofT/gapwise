import type { Meeting } from "@/lib/timetable-types";
import { activeUniversity } from "@/universities/registry";
import { timetableAdapters } from "@/universities/timetable-adapters";

export const MAX_ICS_FILE_BYTES = 2 * 1024 * 1024;

export type TimetableImportResult = Awaited<ReturnType<typeof parseTimetableText>>;

export function validateTimetableFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const university = activeUniversity();
  const allowsText = university?.id === "carleton";
  const isIcs = /\.ics$/i.test(file.name) || file.type === "text/calendar";
  const isText =
    allowsText && (/\.(txt|tsv|csv)$/i.test(file.name) || file.type.startsWith("text/"));
  if (!isIcs && !isText) {
    return "That file type isn't supported. Please choose a .ics calendar file.";
  }
  if (file.size > MAX_ICS_FILE_BYTES) {
    return "That calendar is too large. Please choose an .ics file under 2 MB.";
  }
  return null;
}

export async function parseTimetableText(text: string) {
  const university = activeUniversity();
  if (!university) throw new Error("This university edition is not supported.");
  const adapter = timetableAdapters[university.timetableAdapter];
  if (!adapter) throw new Error(`No timetable adapter is registered for ${university.id}.`);
  return adapter(text);
}

export function timetableImportError(error: unknown): string {
  if (
    error instanceof Error &&
    (error.name === "IcsParseError" || error.name === "TimetableParseError")
  ) {
    return error.message;
  }
  const university = activeUniversity();
  const sourceName = university?.calendarSource ?? "your schedule";
  return `Something went wrong while reading that timetable. Check your ${sourceName} export or schedule text.`;
}

export function describeTimetableChanges(
  previousMeetings: readonly Meeting[],
  nextMeetings: readonly Meeting[],
): string {
  const previousById = new Map(previousMeetings.map((meeting) => [meeting.id, meeting]));
  const nextIds = new Set(nextMeetings.map((meeting) => meeting.id));
  const added = nextMeetings.filter((meeting) => !previousById.has(meeting.id)).length;
  const removed = previousMeetings.filter((meeting) => !nextIds.has(meeting.id)).length;
  const changed = nextMeetings.filter((meeting) => {
    const previous = previousById.get(meeting.id);
    return previous && JSON.stringify(previous) !== JSON.stringify(meeting);
  }).length;
  const changes = [
    added ? `${added} added` : null,
    removed ? `${removed} removed` : null,
    changed ? `${changed} updated` : null,
  ].filter((change): change is string => change !== null);

  return changes.length ? changes.join(" · ") : "no meeting changes";
}

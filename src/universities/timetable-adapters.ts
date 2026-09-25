import type { Meeting, ParsedTimetable } from "@/lib/timetable-types";

/** University integration registry. Shared product surfaces consume ParsedTimetable only. */
export const timetableAdapters: Record<string, (text: string) => Promise<ParsedTimetable>> = {
  "acorn-ics": async (text) => {
    const { parseIcs } = await import("@/lib/ics-parser");
    const { enrichCourseTitles } = await import("@/lib/course-title-catalog");
    const parsed = parseIcs(text);
    return { ...parsed, meetings: await enrichCourseTitles(parsed.meetings) };
  },
  "carleton-ics": async (text) => {
    const { parseCarletonIcs } = await import("./carleton/adapter");
    return parseCarletonIcs(text);
  },
  // GAPWISE_ADAPTER_REGISTRY: the CLI inserts new timetable adapters here.
};

export const demoTimetableLoaders: Record<string, () => Promise<Meeting[]>> = {
  "acorn-ics": async () => (await import("@/lib/demo-timetable")).DEMO_MEETINGS,
  "carleton-ics": async () => {
    const [{ DEMO_CARLETON_MEETINGS }, { normalizeCarletonMeeting }] = await Promise.all([
      import("./carleton/demo-timetable"),
      import("./carleton/adapter"),
    ]);
    return DEMO_CARLETON_MEETINGS.flatMap(normalizeCarletonMeeting);
  },
};

export async function loadDemoTimetable(adapterId?: string): Promise<Meeting[]> {
  const loader = adapterId ? demoTimetableLoaders[adapterId] : undefined;
  if (loader) return loader();
  return (await import("@/lib/demo-timetable")).DEMO_MEETINGS;
}

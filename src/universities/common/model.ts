export const DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Day = (typeof DAYS)[number];
export type LocationKind = "physical" | "online" | "tba";

export interface Meeting {
  id: string;
  institutionId: string;
  courseCode: string;
  nativeSection: string;
  nativeComponentType: string;
  courseName?: string;
  termLabel: string;
  days: Day[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  location: {
    kind: LocationKind;
    nativeText: string;
    buildingId: string | null;
    room: string | null;
  };
  source: {
    kind: "student-entry" | "ics-import" | "sample-timetable" | string;
    recordedAt: string;
  };
}

export type { CampusBuilding as Building, CampusSnapshot } from "@/data/campuses/contract";

export interface InstitutionAdapter {
  id: string;
  name: string;
  parseCourseCode(value: string): string | null;
  sectionLabel: string;
  componentLabel: string;
  publicScheduleUrl: string;
  mapUrl: string;
}

export const dayName: Record<Day, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

export function clock(minutes: string): string {
  const [h, m] = minutes.split(":").map(Number);
  return `${(h ?? 0) % 12 || 12}:${String(m).padStart(2, "0")} ${(h ?? 0) < 12 ? "AM" : "PM"}`;
}

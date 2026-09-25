import { describe, expect, test } from "bun:test";
import {
  tmuCampus,
  tmuScheduleAdapter,
  parseTmuTimetable,
  parseTmuIcs,
  loadTmuDemoTimetable,
} from "@/universities/tmu/adapter";
import { tmu } from "@/universities/tmu/config";
import { parseTmuText } from "@/universities/tmu/text-parser";

describe("TMU Schedule Adapter & Parsers", () => {
  test("parses MyServiceHub tabular schedule text", () => {
    const text = `
Course   Sec  Title                     Days  Time                  Location   Instructor
CPS 109  011  Computer Science I        M     10:00 AM - 12:00 PM   ENG LG07   Woit
CPS 109  012  Lab                       W     02:00 PM - 04:00 PM   ENG 206    Staff
MTH 110  021  Discrete Mathematics I    TR    11:00 AM - 12:30 PM   SHE 683    Kolasa
    `.trim();

    const { meetings, warnings } = parseTmuText(text, tmuCampus, tmu);
    expect(warnings.length).toBe(0);
    expect(meetings.length).toBe(3);

    const csLec = meetings.find((m) => m.courseCode === "CPS 109" && m.nativeSection === "011");
    expect(csLec).toBeDefined();
    expect(csLec!.days).toEqual(["MO"]);
    expect(csLec!.startTime).toBe("10:00");
    expect(csLec!.endTime).toBe("12:00");
    expect(csLec!.location.buildingId).toBe("eng");
    expect(csLec!.location.room).toBe("LG07");

    const mthLec = meetings.find((m) => m.courseCode === "MTH 110");
    expect(mthLec).toBeDefined();
    expect(mthLec!.days).toEqual(["TU", "TH"]);
    expect(mthLec!.startTime).toBe("11:00");
    expect(mthLec!.endTime).toBe("12:30");
    expect(mthLec!.location.buildingId).toBe("she");
  });

  test("parses multiline schedule text with building abbreviations", () => {
    const text = `
CPS 209 Computer Science II
Sec 01 LEC
Mon, Wed 13:00 - 14:30
VIC 205

MTH 207 Calculus and Geometry
Sec 02 LEC
Tue, Thu 09:00 - 10:30
RCC 204
    `.trim();

    const { meetings } = parseTmuText(text, tmuCampus, tmu);
    expect(meetings.length).toBe(2);

    const cs209 = meetings.find((m) => m.courseCode === "CPS 209")!;
    expect(cs209.days).toEqual(["MO", "WE"]);
    expect(cs209.location.buildingId).toBe("vic");
    expect(cs209.location.room).toBe("205");

    const mth207 = meetings.find((m) => m.courseCode === "MTH 207")!;
    expect(mth207.days).toEqual(["TU", "TH"]);
    expect(mth207.location.buildingId).toBe("rcc");
    expect(mth207.location.room).toBe("204");
  });

  test("parses TMU exported Google Calendar (.ics)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:cps-109-011",
      "SUMMARY:CPS 109 011 LEC - Computer Science I",
      "LOCATION:ENG LG07",
      "DTSTART:20260908T100000",
      "DTEND:20260908T120000",
      "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261208T235959",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:mth-110-021",
      "SUMMARY:MTH 110 021 LEC - Discrete Mathematics I",
      "LOCATION:Sally Horsfall Eaton Centre 683",
      "DTSTART:20260908T110000",
      "DTEND:20260908T123000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261208T235959",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const { meetings, warnings } = parseTmuIcs(ics);
    expect(warnings).toHaveLength(0);
    expect(meetings).toHaveLength(3); // 1 on MO, 2 on TU/TH

    const mondayLec = meetings.find((m) => m.weekday === "Monday")!;
    expect(mondayLec.courseCode).toBe("CPS 109");
    expect(mondayLec.campus).toBe("TMU");
    expect(mondayLec.universityId).toBe("tmu");
    expect(mondayLec.buildingCode).toBe("ENG");
    expect(mondayLec.room).toBe("LG07");
  });

  test("dispatches transparently via parseTmuTimetable and normalizes canonical fields", () => {
    const text = `CPS 109 A\nMW 10:00 - 11:30\nENG 101`;
    const result = parseTmuTimetable(text);
    expect(result.meetings.length).toBe(2);
    expect(result.meetings[0]!.universityId).toBe("tmu");
    expect(result.meetings[0]!.campus).toBe("TMU");
  });

  test("loads the TMU demo timetable with valid academic meetings", () => {
    const demo = loadTmuDemoTimetable();
    expect(demo.length).toBeGreaterThan(0);
    for (const meeting of demo) {
      expect(meeting.universityId).toBe("tmu");
      expect(meeting.campus).toBe("TMU");
      expect(meeting.startTime).toBeLessThan(meeting.endTime);
      expect(meeting.buildingCode).toBeDefined();
    }
  });

  test("adapter interface validates and detects TMU inputs", () => {
    expect(tmuScheduleAdapter.universityId).toBe("tmu");
    expect(tmuScheduleAdapter.detect("BEGIN:VCALENDAR")).toBe(true);
    expect(tmuScheduleAdapter.detect("CPS 109 011 Computer Science I")).toBe(true);
    expect(tmuScheduleAdapter.validate("   ").valid).toBe(false);
    expect(tmuScheduleAdapter.validate("CPS 109").valid).toBe(true);
  });
});

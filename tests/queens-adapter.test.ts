import { describe, expect, test } from "bun:test";
import {
  queensCampus,
  queensScheduleAdapter,
  parseQueensTimetable,
  parseQueensIcs,
  loadQueensDemoTimetable,
} from "@/universities/queens/adapter";
import { queens } from "@/universities/queens/config";
import { parseQueensText } from "@/universities/queens/text-parser";

describe("Queen's Schedule Adapter & Parsers", () => {
  test("parses SOLUS tabular schedule text", () => {
    const text = `
Course    Sec  Title                           Days  Time                  Location          Instructor
CISC 121  001  Intro to Computing Science      MWF   09:30 AM - 10:30 AM   Dunning Hall 014  McLeod
CISC 121  002  Lab                             M     02:30 PM - 04:30 PM   Goodwin Hall 235  Staff
MATH 120  001  Differential & Integral Calc    TR    11:30 AM - 01:00 PM   Jeffery Hall 126  Offin
    `.trim();

    const { meetings, warnings } = parseQueensText(text, queensCampus, queens);
    expect(warnings.length).toBe(0);
    expect(meetings.length).toBe(3);

    const ciscLec = meetings.find((m) => m.courseCode === "CISC 121" && m.nativeSection === "001");
    expect(ciscLec).toBeDefined();
    expect(ciscLec!.days).toEqual(["MO", "WE", "FR"]);
    expect(ciscLec!.startTime).toBe("09:30");
    expect(ciscLec!.endTime).toBe("10:30");
    expect(ciscLec!.location.buildingId).toBe("dunning-hall");
    expect(ciscLec!.location.room).toBe("014");

    const mathLec = meetings.find((m) => m.courseCode === "MATH 120");
    expect(mathLec).toBeDefined();
    expect(mathLec!.days).toEqual(["TU", "TH"]);
    expect(mathLec!.startTime).toBe("11:30");
    expect(mathLec!.endTime).toBe("13:00");
    expect(mathLec!.location.buildingId).toBe("jeffery-hall");
    expect(mathLec!.location.room).toBe("126");
  });

  test("parses multiline schedule text with building abbreviations", () => {
    const text = `
CISC 223 Software Specifications
Sec 001 LEC
Mon, Wed 14:30 - 16:00
WLH 201

APSC 100 Engineering Practice
Sec 002 LEC
Tue, Thu 08:30 - 10:00
BMH 112
    `.trim();

    const { meetings } = parseQueensText(text, queensCampus, queens);
    expect(meetings.length).toBe(2);

    const cisc223 = meetings.find((m) => m.courseCode === "CISC 223")!;
    expect(cisc223.days).toEqual(["MO", "WE"]);
    expect(cisc223.location.buildingId).toBe("walter-light-hall");
    expect(cisc223.location.room).toBe("201");

    const apsc100 = meetings.find((m) => m.courseCode === "APSC 100")!;
    expect(apsc100.days).toEqual(["TU", "TH"]);
    expect(apsc100.location.buildingId).toBe("beamish-munro-hall");
    expect(apsc100.location.room).toBe("112");
  });

  test("parses Queen's SOLUS subscription (.ics)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:cisc-121-001",
      "SUMMARY:CISC 121 001 LEC - Intro to Computing Science",
      "LOCATION:DUN 014",
      "DTSTART:20260908T093000",
      "DTEND:20260908T103000",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261208T235959",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:math-120-001",
      "SUMMARY:MATH 120 001 LEC - Differential Calculus",
      "LOCATION:Jeffery Hall 126",
      "DTSTART:20260908T113000",
      "DTEND:20260908T130000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261208T235959",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const { meetings, warnings } = parseQueensIcs(ics);
    expect(warnings).toHaveLength(0);
    expect(meetings).toHaveLength(5); // 3 on MWF, 2 on TR

    const monMeeting = meetings.find((m) => m.weekday === "Monday")!;
    expect(monMeeting.courseCode).toBe("CISC 121");
    expect(monMeeting.campus).toBe("QUEENS");
    expect(monMeeting.universityId).toBe("queens");
    expect(monMeeting.buildingCode).toBe("DUN");
    expect(monMeeting.room).toBe("014");
  });

  test("dispatches transparently via parseQueensTimetable and normalizes canonical fields", () => {
    const text = `CISC 121 001\nMWF 09:30 - 10:30\nDUN 014`;
    const result = parseQueensTimetable(text);
    expect(result.meetings.length).toBe(3);
    expect(result.meetings[0]!.universityId).toBe("queens");
    expect(result.meetings[0]!.campus).toBe("QUEENS");
  });

  test("loads the Queen's demo timetable with valid academic meetings", () => {
    const demo = loadQueensDemoTimetable();
    expect(demo.length).toBeGreaterThan(0);
    for (const meeting of demo) {
      expect(meeting.universityId).toBe("queens");
      expect(meeting.campus).toBe("QUEENS");
      expect(meeting.startTime).toBeLessThan(meeting.endTime);
      expect(meeting.buildingCode).toBeDefined();
    }
  });

  test("adapter interface validates and detects Queen's inputs", () => {
    expect(queensScheduleAdapter.universityId).toBe("queens");
    expect(queensScheduleAdapter.detect("BEGIN:VCALENDAR")).toBe(true);
    expect(queensScheduleAdapter.detect("CISC 121 001 Intro to Computing")).toBe(true);
    expect(queensScheduleAdapter.validate("   ").valid).toBe(false);
    expect(queensScheduleAdapter.validate("CISC 121").valid).toBe(true);
  });
});

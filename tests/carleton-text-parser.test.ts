import { describe, expect, test } from "bun:test";
import { carletonCampus, parseCarletonTimetable } from "@/universities/carleton/adapter";
import { carleton } from "@/universities/carleton/config";
import { parseCarletonText } from "@/universities/carleton/text-parser";

describe("Carleton Central schedule text parser", () => {
  test("parses Carleton Central Concise Student Schedule format", () => {
    const text = `
CRN    Course     Sec  Title                               CrHr  Days  Time                 Location             Instructor
31234  COMP 1405  A    Introduction to Computer Science I  0.50  TR    10:05 am - 11:25 am  Tory Building 208    Smith
31235  COMP 1405  A1   Tutorial                            0.00  M     02:35 pm - 03:55 pm  MacOdrum Library 252 Doe
31550  MATH 1007  B    Elementary Calculus I               0.50  MWF   08:35 am - 09:25 am  Azrieli Theatre 101  Johnson
    `.trim();

    const { meetings, warnings } = parseCarletonText(text, carletonCampus, carleton);
    expect(warnings.length).toBe(0);
    expect(meetings.length).toBe(3);

    const compLec = meetings.find((m) => m.courseCode === "COMP 1405" && m.nativeSection === "A");
    expect(compLec).toBeDefined();
    expect(compLec!.days).toEqual(["TU", "TH"]);
    expect(compLec!.startTime).toBe("10:05");
    expect(compLec!.endTime).toBe("11:25");
    expect(compLec!.location.buildingId).toBe("tory-building");
    expect(compLec!.location.room).toBe("208");

    const compTut = meetings.find((m) => m.courseCode === "COMP 1405" && m.nativeSection === "A1");
    expect(compTut).toBeDefined();
    expect(compTut!.days).toEqual(["MO"]);
    expect(compTut!.startTime).toBe("14:35");
    expect(compTut!.endTime).toBe("15:55");
    expect(compTut!.location.buildingId).toBe("macodrum-library");
    expect(compTut!.location.room).toBe("252");

    const mathLec = meetings.find((m) => m.courseCode === "MATH 1007");
    expect(mathLec).toBeDefined();
    expect(mathLec!.days).toEqual(["MO", "WE", "FR"]);
    expect(mathLec!.startTime).toBe("08:35");
    expect(mathLec!.endTime).toBe("09:25");
    expect(mathLec!.location.buildingId).toBe("azrieli-theatre");
    expect(mathLec!.location.room).toBe("101");
  });

  test("parses Carleton Central Detail Schedule format", () => {
    const text = `
COMP 1405 - Introduction to Computer Science I
Associated Term: Fall 2026
CRN: 31234
Status: **Registered**
Assigned Instructor: Jane Doe
Grade Mode: Standard Letter
Credits: 0.500
Campus: Main Campus
Scheduled Meeting Times
Type    Time                    Days    Where                   Date Range                  Schedule Type   Instructors
Class   10:05 am - 11:25 am     TR      Tory Building 208       Sep 04, 2026 - Dec 08, 2026  Lecture         Jane Doe (P)
    `.trim();

    const { meetings, warnings } = parseCarletonText(text, carletonCampus, carleton);
    expect(warnings.length).toBe(0);
    expect(meetings.length).toBe(1);

    const meeting = meetings[0]!;
    expect(meeting.courseCode).toBe("COMP 1405");
    expect(meeting.days).toEqual(["TU", "TH"]);
    expect(meeting.startTime).toBe("10:05");
    expect(meeting.endTime).toBe("11:25");
    expect(meeting.location.buildingId).toBe("tory-building");
    expect(meeting.location.room).toBe("208");
  });

  test("parses multi-line text and abbreviation days and short building codes", () => {
    const text = `
BUSI 1004 B
Tuesday, Thursday 14:35 - 15:55
TB 208

SYSC 2004 A
MWF 11:35 am - 12:25 pm
CB 2202
    `.trim();

    const { meetings } = parseCarletonText(text, carletonCampus, carleton);
    expect(meetings.length).toBe(2);

    const busi = meetings.find((m) => m.courseCode === "BUSI 1004")!;
    expect(busi.days).toEqual(["TU", "TH"]);
    expect(busi.startTime).toBe("14:35");
    expect(busi.endTime).toBe("15:55");
    expect(busi.location.buildingId).toBe("tory-building");

    const sysc = meetings.find((m) => m.courseCode === "SYSC 2004")!;
    expect(sysc.days).toEqual(["MO", "WE", "FR"]);
    expect(sysc.startTime).toBe("11:35");
    expect(sysc.endTime).toBe("12:25");
    expect(sysc.location.buildingId).toBe("canal-building");
  });

  test("parseCarletonTimetable transparently dispatches text or ICS", () => {
    const text = `
COMP 1405 A
TR 10:05 am - 11:25 am
Tory Building 208
    `.trim();

    const result = parseCarletonTimetable(text);
    expect(result.meetings.length).toBe(2); // Tuesday and Thursday normalized meetings
    expect(result.meetings[0]!.buildingCode).toBe("TB");
    expect(result.meetings[0]!.weekday).toBe("Tuesday");
    expect(result.meetings[1]!.weekday).toBe("Thursday");
  });

  test("parseCarletonTimetable parses Carleton iCalendar schedules", () => {
    const sampleIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Test Calendar App//Synthetic Fixture//EN",
      "BEGIN:VEVENT",
      "UID:comp-1405-2026",
      "SUMMARY:COMP 1405 A LEC - Intro to Computer Science",
      "LOCATION:TB 208",
      "DTSTART:20260909T100500",
      "DTEND:20260909T112500",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261209T235959",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:busi-1004-2026",
      "SUMMARY:BUSI 1004 A Financial Accounting",
      "LOCATION:DT 2203",
      "DTSTART:20260909T143500",
      "DTEND:20260909T155500",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261209T235959",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseCarletonTimetable(sampleIcs);
    expect(result.warnings.length).toBe(0);
    expect(result.meetings.length).toBe(4);

    const compMeetings = result.meetings.filter((m) => m.courseCode === "COMP 1405");
    expect(compMeetings.length).toBe(2);
    expect(compMeetings[0]!.buildingCode).toBe("TB");
    expect(compMeetings[0]!.room).toBe("208");
    expect(compMeetings[0]!.startTime).toBe(10 * 60 + 5);
    expect(compMeetings[0]!.endTime).toBe(11 * 60 + 25);
  });
});

import { describe, expect, test } from "bun:test";
import {
  laurierCampus,
  laurierScheduleAdapter,
  parseLaurierTimetable,
  parseLaurierIcs,
  loadLaurierDemoTimetable,
} from "./adapter";
import { laurier } from "./config";
import { parseLaurierText } from "./text-parser";

describe("Laurier Schedule Adapter & Parsers", () => {
  test("parses LORIS tabular schedule text", () => {
    const text = `
Course  Sec  Title                         Days  Time                  Location  Instructor
CP 104  A    Introduction to Programming   MWF   08:30 AM - 09:20 AM   LH 1009   Brown
CP 104  L1   Lab                           W     02:30 PM - 04:20 PM   BA 201    Staff
BU 111  B    Understanding Business        TR    10:00 AM - 11:20 AM   P 1025    Smith
    `.trim();

    const { meetings, warnings } = parseLaurierText(text, laurierCampus, laurier);
    expect(warnings.length).toBe(0);
    expect(meetings.length).toBe(3);

    const cpLec = meetings.find((m) => m.courseCode === "CP 104" && m.nativeSection === "A");
    expect(cpLec).toBeDefined();
    expect(cpLec!.days).toEqual(["MO", "WE", "FR"]);
    expect(cpLec!.startTime).toBe("08:30");
    expect(cpLec!.endTime).toBe("09:20");
    expect(cpLec!.location.buildingId).toBe("lazaridis-hall");
    expect(cpLec!.location.room).toBe("1009");

    const buLec = meetings.find((m) => m.courseCode === "BU 111");
    expect(buLec).toBeDefined();
    expect(buLec!.days).toEqual(["TU", "TH"]);
    expect(buLec!.startTime).toBe("10:00");
    expect(buLec!.endTime).toBe("11:20");
    expect(buLec!.location.buildingId).toBe("peters-building");
    expect(buLec!.location.room).toBe("1025");
  });

  test("parses multiline schedule text with building abbreviations", () => {
    const text = `
MA 122 Linear Algebra
Sec A LEC
Mon, Wed, Fri 11:30 - 12:20
BA 110

PS 101 Introduction to Psychology
Sec B LEC
Tue, Thu 13:00 - 14:20
DAWB 2001
    `.trim();

    const { meetings } = parseLaurierText(text, laurierCampus, laurier);
    expect(meetings.length).toBe(2);

    const ma122 = meetings.find((m) => m.courseCode === "MA 122")!;
    expect(ma122.days).toEqual(["MO", "WE", "FR"]);
    expect(ma122.location.buildingId).toBe("bricker-academic");
    expect(ma122.location.room).toBe("110");

    const ps101 = meetings.find((m) => m.courseCode === "PS 101")!;
    expect(ps101.days).toEqual(["TU", "TH"]);
    expect(ps101.location.buildingId).toBe("alvin-woods-building");
    expect(ps101.location.room).toBe("2001");
  });

  test("parses Laurier MyLearningSpace export (.ics)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:cp-104-a",
      "SUMMARY:CP 104 A LEC - Intro to Programming",
      "LOCATION:LH 1009",
      "DTSTART:20260908T083000",
      "DTEND:20260908T092000",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261208T235959",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:bu-111-b",
      "SUMMARY:BU 111 B LEC - Understanding Business",
      "LOCATION:Peters Building 1025",
      "DTSTART:20260908T100000",
      "DTEND:20260908T112000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261208T235959",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const { meetings, warnings } = parseLaurierIcs(ics);
    expect(warnings).toHaveLength(0);
    expect(meetings).toHaveLength(5); // 3 on MWF, 2 on TR

    const monMeeting = meetings.find((m) => m.weekday === "Monday")!;
    expect(monMeeting.courseCode).toBe("CP 104");
    expect(monMeeting.campus).toBe("WATERLOO");
    expect(monMeeting.universityId).toBe("laurier");
    expect(monMeeting.buildingCode).toBe("LH");
    expect(monMeeting.room).toBe("1009");
  });

  test("dispatches transparently via parseLaurierTimetable and normalizes canonical fields", () => {
    const text = `CP 104 A\nMWF 08:30 - 09:20\nLH 1009`;
    const result = parseLaurierTimetable(text);
    expect(result.meetings.length).toBe(3);
    expect(result.meetings[0]!.universityId).toBe("laurier");
    expect(result.meetings[0]!.campus).toBe("WATERLOO");
  });

  test("loads the Laurier demo timetable with valid academic meetings", () => {
    const demo = loadLaurierDemoTimetable();
    expect(demo.length).toBeGreaterThan(0);
    for (const meeting of demo) {
      expect(meeting.universityId).toBe("laurier");
      expect(meeting.campus).toBe("WATERLOO");
      expect(meeting.startTime).toBeLessThan(meeting.endTime);
      expect(meeting.buildingCode).toBeDefined();
    }
  });

  test("adapter interface validates and detects Laurier inputs", () => {
    expect(laurierScheduleAdapter.universityId).toBe("laurier");
    expect(laurierScheduleAdapter.detect("BEGIN:VCALENDAR")).toBe(true);
    expect(laurierScheduleAdapter.detect("CP 104 A Intro to Programming")).toBe(true);
    expect(laurierScheduleAdapter.validate("   ").valid).toBe(false);
    expect(laurierScheduleAdapter.validate("CP 104").valid).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  campusBuildingEntrances,
  campusBuildingConfigurations,
  campusFootprintCollection,
  campusMapAttribution,
  getBuildingFootprintForCampus,
  resolveCampusBuildingLocation,
} from "@/data/campuses";
import { routeBetweenBuildings, getRoutingGraph } from "@/features/routing/campus-outdoor-graph";
import {
  planOutdoorCampusTransition,
  createOutdoorCampusTransitionPlanner,
} from "@/features/routing/carleton-transition";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { parseIcs as parseUoftIcs } from "@/lib/ics-parser";
import { parseCarletonIcs, carletonCampus } from "@/universities/carleton/adapter";
import { timetableAdapters, loadDemoTimetable } from "@/universities/timetable-adapters";
import {
  universityById,
  universityForHostname,
  validateUniversityManifest,
} from "@/universities/registry";

const carletonIcs = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:comp-1405",
  "SUMMARY:COMP 1405 A LEC - Intro to Computer Science",
  "LOCATION:TB 208",
  "DTSTART:20260909T100500",
  "DTEND:20260909T112500",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261209T235959",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:busi-1004",
  "SUMMARY:BUSI 1004 A LEC - Financial Accounting",
  "LOCATION:DT 2203",
  "DTSTART:20260909T143500",
  "DTEND:20260909T155500",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261209T235959",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("university registry", () => {
  test("resolves production hosts and local preview override", () => {
    expect(universityForHostname("gapwise.ca")?.id).toBe("uoft");
    expect(universityForHostname("GAPWISE.CA")?.id).toBe("uoft");
    expect(universityForHostname("gapwise.ca.")?.id).toBe("uoft");
    expect(universityForHostname("www.gapwise.ca")?.id).toBe("uoft");
    expect(universityForHostname("carleton.gapwise.ca")?.id).toBe("carleton");
    expect(universityForHostname("CARLETON.GAPWISE.CA.")?.id).toBe("carleton");
    expect(universityForHostname("localhost")?.id).toBe("uoft");
    expect(universityForHostname("localhost", "carleton")?.id).toBe("carleton");
    expect(universityForHostname("gapwise.ca", "carleton")?.id).toBe("uoft");
    expect(universityForHostname("unknown.gapwise.ca")).toBeNull();
    expect(universityForHostname("tmu.gapwise.ca")).toBeNull();
    expect(universityForHostname("attacker.com")).toBeNull();
    expect(universityById("waterloo")).toBeNull();
  });

  test("rejects malformed manifest entries", () => {
    expect(validateUniversityManifest()).toEqual([]);
    const uoft = universityById("uoft")!;
    expect(
      validateUniversityManifest([
        { ...uoft, id: "Invalid ID", hosts: ["gapwise.ca", "gapwise.ca"], defaultCampus: "other" },
      ]).length,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("canonical meeting and campus data contracts", () => {
  test("preserves the UofT parser output", () => {
    const fixture = readFileSync(
      new URL("./fixtures/acorn-edge-cases.ics", import.meta.url),
      "utf8",
    );
    expect(parseUoftIcs(fixture).meetings[0]).toMatchObject({
      courseCode: "CSC108H5",
      campus: "UTM",
    });
  });

  test("normalizes Carleton ICS to shared meeting fields and retains native semantics", () => {
    const { meetings, warnings } = parseCarletonIcs(carletonIcs);
    expect(warnings).toEqual([]);
    expect(meetings).toHaveLength(4);
    expect(meetings[0]).toMatchObject({
      universityId: "carleton",
      courseCode: "COMP 1405",
      nativeSection: "A",
      nativeComponentType: "LEC",
      weekday: "Monday",
      startTime: 605,
      endTime: 685,
      buildingCode: "TB",
      room: "208",
      campus: "CARLETON",
      term: "Fall",
      dateRange: { startDate: "2026-09-09", endDate: "2026-12-09" },
    });
  });

  test("loads the canonical Carleton snapshot and resolves aliases and mapped doors", () => {
    expect(campusMapAttribution("carleton")).toContain("openstreetmap.org/copyright");
    expect(carletonCampus.institution).toBe("carleton");
    expect(carletonCampus.buildings).toHaveLength(48);
    expect(campusBuildingConfigurations("carleton")).toHaveLength(48);
    expect(campusFootprintCollection("carleton").features.length).toBeGreaterThan(40);
    expect(getBuildingFootprintForCampus("carleton", "TB")?.properties.buildingId).toBe(
      "tory-building",
    );
    expect(resolveCampusBuildingLocation("carleton", "Tory Building 208")?.building.code).toBe(
      "TB",
    );
    expect(resolveCampusBuildingLocation("carleton", "Unknown Campus Wing 208")).toBeNull();
    const doors = campusBuildingEntrances("carleton", "TB");
    expect(doors.every((door) => door.accessibility === "unknown")).toBe(true);
  });

  test("reuses the precomputed outdoor graph and route cache", () => {
    const graph = getRoutingGraph(carletonCampus);
    expect(getRoutingGraph(carletonCampus)).toBe(graph);
    const from = parseCarletonIcs(carletonIcs).meetings.find(
      (meeting) => meeting.courseCode === "COMP 1405",
    )!;
    const to = parseCarletonIcs(carletonIcs).meetings.find(
      (meeting) => meeting.courseCode === "BUSI 1004",
    )!;
    const result = planOutdoorCampusTransition(from, to, DEFAULT_ROUTE_PREFERENCES);
    expect(result.status).toBe("routed");
    expect(result.displayCoordinates.length).toBeGreaterThan(2);
    expect(routeBetweenBuildings("tory-building", "dunton-tower", carletonCampus).status).toBe(
      "ready",
    );
    expect(graph.routeCache.size).toBeGreaterThan(0);
    expect(
      planOutdoorCampusTransition(from, to, { ...DEFAULT_ROUTE_PREFERENCES, mode: "step-free" })
        .status,
    ).toBe("unavailable");
  });

  test("timetable adapters registry loads registered adapters and demo schedules", async () => {
    expect(typeof timetableAdapters["acorn-ics"]).toBe("function");
    expect(typeof timetableAdapters["carleton-ics"]).toBe("function");

    const uoftDemo = await loadDemoTimetable("acorn-ics");
    expect(uoftDemo.length).toBeGreaterThan(0);
    expect(uoftDemo.some((m) => m.courseCode.includes("DEM101"))).toBe(true);

    const carletonDemo = await loadDemoTimetable("carleton-ics");
    expect(carletonDemo.length).toBeGreaterThan(0);
    expect(carletonDemo.every((m) => m.universityId === "carleton")).toBe(true);

    const fallbackDemo = await loadDemoTimetable(undefined);
    expect(fallbackDemo).toEqual(uoftDemo);
  });

  test("generic outdoor transition planner creates route transitions from campus snapshots", () => {
    const planner = createOutdoorCampusTransitionPlanner(carletonCampus);
    const { meetings } = parseCarletonIcs(carletonIcs);
    const from = meetings.find((m) => m.courseCode === "COMP 1405")!;
    const to = meetings.find((m) => m.courseCode === "BUSI 1004")!;

    const route = planner(from, to, DEFAULT_ROUTE_PREFERENCES);
    expect(route.status).toBe("routed");
    expect(route.result?.outdoorDistanceMeters).toBeGreaterThan(0);

    const nonPhysical = { ...from, locationType: "online" as const };
    const nonPhysicalRoute = planner(nonPhysical, to, DEFAULT_ROUTE_PREFERENCES);
    expect(nonPhysicalRoute.status).toBe("unavailable");
    expect(nonPhysicalRoute.message).toContain("physical route requires two known");

    const diffCampus = { ...from, campus: "UTM" as const };
    const diffCampusRoute = planner(diffCampus, to, DEFAULT_ROUTE_PREFERENCES);
    expect(diffCampusRoute.status).toBe("unavailable");
    expect(diffCampusRoute.message).toContain("same campus");
  });
});

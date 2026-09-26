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
    expect(universityForHostname("tmu.gapwise.ca")?.id).toBe("tmu");
    expect(universityForHostname("queens.gapwise.ca")?.id).toBe("queens");
    expect(universityForHostname("laurier.gapwise.ca")?.id).toBe("laurier");
    expect(universityForHostname("york.gapwise.ca")?.id).toBe("york");
    expect(universityForHostname("mcmaster.gapwise.ca")?.id).toBe("mcmaster");
    expect(universityForHostname("western.gapwise.ca")?.id).toBe("western");
    expect(universityForHostname("guelph.gapwise.ca")?.id).toBe("guelph");
    expect(universityForHostname("uottawa.gapwise.ca")?.id).toBe("uottawa");
    expect(universityForHostname("brock.gapwise.ca")?.id).toBe("brock");
    expect(universityForHostname("localhost")?.id).toBe("uoft");
    expect(universityForHostname("localhost", "carleton")?.id).toBe("carleton");
    expect(universityForHostname("localhost", "tmu")?.id).toBe("tmu");
    expect(universityForHostname("preview-branch.vercel.app")?.id).toBe("uoft");
    expect(universityForHostname("preview-branch.vercel.app", "queens")?.id).toBe("queens");
    expect(universityForHostname("preview-branch.vercel.app", "laurier")?.id).toBe("laurier");
    expect(universityForHostname("preview-branch.vercel.app", "york")?.id).toBe("york");
    expect(universityForHostname("preview-branch.vercel.app", "mcmaster")?.id).toBe("mcmaster");
    expect(universityForHostname("preview-branch.vercel.app", "western")?.id).toBe("western");
    expect(universityForHostname("preview-branch.vercel.app", "guelph")?.id).toBe("guelph");
    expect(universityForHostname("preview-branch.vercel.app", "uottawa")?.id).toBe("uottawa");
    expect(universityForHostname("preview-branch.vercel.app", "brock")?.id).toBe("brock");
    expect(universityForHostname("gapwise.ca", "carleton")?.id).toBe("uoft");
    expect(universityForHostname("unknown.gapwise.ca")).toBeNull();
    expect(universityForHostname("attacker.com")).toBeNull();
    expect(universityById("nonexistent")).toBeNull();
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
    expect(typeof timetableAdapters["tmu-schedule"]).toBe("function");
    expect(typeof timetableAdapters["queens-schedule"]).toBe("function");
    expect(typeof timetableAdapters["laurier-schedule"]).toBe("function");
    expect(typeof timetableAdapters["york-schedule"]).toBe("function");
    expect(typeof timetableAdapters["mcmaster-schedule"]).toBe("function");
    expect(typeof timetableAdapters["western-schedule"]).toBe("function");
    expect(typeof timetableAdapters["guelph-schedule"]).toBe("function");
    expect(typeof timetableAdapters["uottawa-schedule"]).toBe("function");
    expect(typeof timetableAdapters["brock-schedule"]).toBe("function");

    const uoftDemo = await loadDemoTimetable("acorn-ics");
    expect(uoftDemo.length).toBeGreaterThan(0);
    expect(uoftDemo.some((m) => m.courseCode.includes("DEM101"))).toBe(true);

    const carletonDemo = await loadDemoTimetable("carleton-ics");
    expect(carletonDemo.length).toBeGreaterThan(0);
    expect(carletonDemo.every((m) => m.universityId === "carleton")).toBe(true);

    const tmuDemo = await loadDemoTimetable("tmu-schedule");
    expect(tmuDemo.length).toBeGreaterThan(0);
    expect(tmuDemo.every((m) => m.universityId === "tmu")).toBe(true);

    const queensDemo = await loadDemoTimetable("queens-schedule");
    expect(queensDemo.length).toBeGreaterThan(0);
    expect(queensDemo.every((m) => m.universityId === "queens")).toBe(true);

    const laurierDemo = await loadDemoTimetable("laurier-schedule");
    expect(laurierDemo.length).toBeGreaterThan(0);
    expect(laurierDemo.every((m) => m.universityId === "laurier")).toBe(true);

    const yorkDemo = await loadDemoTimetable("york-schedule");
    expect(yorkDemo.length).toBeGreaterThan(0);
    expect(yorkDemo.every((m) => m.universityId === "york")).toBe(true);

    const mcmasterDemo = await loadDemoTimetable("mcmaster-schedule");
    expect(mcmasterDemo.length).toBeGreaterThan(0);
    expect(mcmasterDemo.every((m) => m.universityId === "mcmaster")).toBe(true);

    const westernDemo = await loadDemoTimetable("western-schedule");
    expect(westernDemo.length).toBeGreaterThan(0);
    expect(westernDemo.every((m) => m.universityId === "western")).toBe(true);

    const guelphDemo = await loadDemoTimetable("guelph-schedule");
    expect(guelphDemo.length).toBeGreaterThan(0);
    expect(guelphDemo.every((m) => m.universityId === "guelph")).toBe(true);

    const uottawaDemo = await loadDemoTimetable("uottawa-schedule");
    expect(uottawaDemo.length).toBeGreaterThan(0);
    expect(uottawaDemo.every((m) => m.universityId === "uottawa")).toBe(true);

    const brockDemo = await loadDemoTimetable("brock-schedule");
    expect(brockDemo.length).toBeGreaterThan(0);
    expect(brockDemo.every((m) => m.universityId === "brock")).toBe(true);

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

  test("loads York and McMaster campus models and plans transitions", async () => {
    const { yorkCampus } = await import("@/universities/york/adapter");
    const { mcmasterCampus } = await import("@/universities/mcmaster/adapter");

    expect(yorkCampus.institution).toBe("york");
    expect(yorkCampus.buildings.length).toBeGreaterThanOrEqual(30);
    expect(yorkCampus.entrances.length).toBeGreaterThanOrEqual(30);

    expect(mcmasterCampus.institution).toBe("mcmaster");
    expect(mcmasterCampus.buildings.length).toBeGreaterThanOrEqual(30);
    expect(mcmasterCampus.entrances.length).toBeGreaterThanOrEqual(30);

    const yorkPlanner = createOutdoorCampusTransitionPlanner(yorkCampus);
    const yorkDemo = await loadDemoTimetable("york-schedule");
    const yFrom = yorkDemo.find((m) => m.courseCode === "EECS 1022" && m.activityType === "LEC")!;
    const yTo = yorkDemo.find((m) => m.courseCode === "MATH 1013")!;
    const yorkRoute = yorkPlanner(yFrom, yTo, DEFAULT_ROUTE_PREFERENCES);
    expect(yorkRoute.status).toBe("routed");
    expect(yorkRoute.result?.outdoorDistanceMeters).toBeGreaterThan(0);

    const macPlanner = createOutdoorCampusTransitionPlanner(mcmasterCampus);
    const macDemo = await loadDemoTimetable("mcmaster-schedule");
    const mFrom = macDemo.find((m) => m.courseCode === "COMPSCI 1MD3")!;
    const mTo = macDemo.find((m) => m.courseCode === "MATH 1ZA3")!;
    const macRoute = macPlanner(mFrom, mTo, DEFAULT_ROUTE_PREFERENCES);
    expect(macRoute.status).toBe("routed");
    expect(macRoute.result?.outdoorDistanceMeters).toBeGreaterThan(0);
  });

  test("loads Western, Guelph, uOttawa, and Brock campus models and plans transitions", async () => {
    const { westernCampus } = await import("@/universities/western/adapter");
    const { guelphCampus } = await import("@/universities/guelph/adapter");
    const { uottawaCampus } = await import("@/universities/uottawa/adapter");
    const { brockCampus } = await import("@/universities/brock/adapter");

    expect(westernCampus.institution).toBe("western");
    expect(westernCampus.buildings.length).toBeGreaterThanOrEqual(15);
    expect(westernCampus.entrances.length).toBeGreaterThanOrEqual(15);

    expect(guelphCampus.institution).toBe("guelph");
    expect(guelphCampus.buildings.length).toBeGreaterThanOrEqual(12);
    expect(guelphCampus.entrances.length).toBeGreaterThanOrEqual(12);

    expect(uottawaCampus.institution).toBe("uottawa");
    expect(uottawaCampus.buildings.length).toBeGreaterThanOrEqual(15);
    expect(uottawaCampus.entrances.length).toBeGreaterThanOrEqual(15);

    expect(brockCampus.institution).toBe("brock");
    expect(brockCampus.buildings.length).toBeGreaterThanOrEqual(10);
    expect(brockCampus.entrances.length).toBeGreaterThanOrEqual(10);

    const westernPlanner = createOutdoorCampusTransitionPlanner(westernCampus);
    const westernDemo = await loadDemoTimetable("western-schedule");
    const wFrom = westernDemo.find((m) => m.courseCode === "COMPSCI 1026A")!;
    const wTo = westernDemo.find((m) => m.courseCode === "MATH 1600A")!;
    const westernRoute = westernPlanner(wFrom, wTo, DEFAULT_ROUTE_PREFERENCES);
    expect(westernRoute.status).toBe("routed");
    expect(westernRoute.result?.outdoorDistanceMeters).toBeGreaterThan(0);

    const guelphPlanner = createOutdoorCampusTransitionPlanner(guelphCampus);
    const guelphDemo = await loadDemoTimetable("guelph-schedule");
    const gFrom = guelphDemo.find((m) => m.courseCode === "CIS 1300")!;
    const gTo = guelphDemo.find((m) => m.courseCode === "MATH 1200")!;
    const guelphRoute = guelphPlanner(gFrom, gTo, DEFAULT_ROUTE_PREFERENCES);
    expect(guelphRoute.status).toBe("routed");
    expect(guelphRoute.result?.outdoorDistanceMeters).toBeGreaterThan(0);

    const uottawaPlanner = createOutdoorCampusTransitionPlanner(uottawaCampus);
    const uottawaDemo = await loadDemoTimetable("uottawa-schedule");
    const uFrom = uottawaDemo.find((m) => m.courseCode === "CSI 2110")!;
    const uTo = uottawaDemo.find((m) => m.courseCode === "MAT 1320")!;
    const uottawaRoute = uottawaPlanner(uFrom, uTo, DEFAULT_ROUTE_PREFERENCES);
    expect(uottawaRoute.status).toBe("routed");
    expect(uottawaRoute.result?.outdoorDistanceMeters).toBeGreaterThan(0);

    const brockPlanner = createOutdoorCampusTransitionPlanner(brockCampus);
    const brockDemo = await loadDemoTimetable("brock-schedule");
    const bFrom = brockDemo.find((m) => m.courseCode === "COSC 1P02")!;
    const bTo = brockDemo.find((m) => m.courseCode === "MATH 1P66")!;
    const brockRoute = brockPlanner(bFrom, bTo, DEFAULT_ROUTE_PREFERENCES);
    expect(brockRoute.status).toBe("routed");
    expect(brockRoute.result?.outdoorDistanceMeters).toBeGreaterThan(0);
  });
});

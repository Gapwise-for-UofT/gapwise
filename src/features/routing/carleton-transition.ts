import type { CampusSnapshot } from "@/data/campuses/contract";
import { carletonCampus } from "@/universities/carleton/adapter";
import { routeBetweenBuildings } from "./campus-outdoor-graph";
import type { TransitionPlanner } from "./transition";
import type { RoutePreferences, TransitionRoute } from "./types";
import type { Meeting } from "@/lib/timetable-types";

function unavailable(message: string): TransitionRoute {
  return {
    status: "unavailable",
    message,
    accuracy: "Location unavailable",
    result: null,
    displayCoordinates: [],
    warnings: [],
    approximateDistanceMeters: null,
    approximateSeconds: null,
  };
}

export function createOutdoorCampusTransitionPlanner(campus: CampusSnapshot): TransitionPlanner {
  const byCode = new Map(
    campus.buildings.flatMap((building) =>
      building.nativeCodes.map((code) => [code.toUpperCase(), building.id] as const),
    ),
  );
  const validCampuses = new Set([
    campus.campus.id.toUpperCase(),
    campus.institution.toUpperCase(),
    "CARLETON",
    "TMU",
    "QUEENS",
    "WATERLOO",
    "LAURIER",
  ]);

  return function planOutdoorTransition(
    from: Meeting,
    to: Meeting,
    preferences: RoutePreferences,
  ): TransitionRoute {
    if (from.campus && to.campus && from.campus !== to.campus)
      return unavailable("A mapped route requires both classes on the same campus.");
    if (from.campus && !validCampuses.has(from.campus.toUpperCase()))
      return unavailable("A mapped route requires both classes on the same campus.");
    if (from.locationType !== "physical" || to.locationType !== "physical")
      return unavailable("A physical route requires two known campus locations.");
    const fromId = from.buildingCode ? byCode.get(from.buildingCode.toUpperCase()) : null;
    const toId = to.buildingCode ? byCode.get(to.buildingCode.toUpperCase()) : null;
    if (!fromId || !toId)
      return unavailable("A mapped building is needed at each end of this route.");
    if (preferences.mode === "step-free")
      return unavailable("Step-free access has not been verified for this pedestrian network.");
    const route = routeBetweenBuildings(fromId, toId, campus, preferences.walkingSpeedMps);
    if (route.status !== "ready") return unavailable(route.reason);
    const estimatedSeconds = route.distanceMeters / Math.max(0.5, preferences.walkingSpeedMps);
    const warnings = ["Outdoor path is mapped; entrance and indoor access may be unverified."];
    return {
      status: "routed",
      message: `${Math.max(1, Math.ceil(estimatedSeconds / 60))} min mapped outdoor walk`,
      accuracy: "Mapped campus path, indoor estimate",
      result: {
        nodes: [],
        edges: [],
        totalDistanceMeters: route.distanceMeters,
        indoorDistanceMeters: 0,
        outdoorDistanceMeters: route.distanceMeters,
        estimatedSeconds,
        floorChanges: 0,
        warnings,
        coordinates: route.coordinates,
      },
      displayCoordinates: route.coordinates,
      warnings,
      approximateDistanceMeters: null,
      approximateSeconds: null,
    };
  };
}

export const planOutdoorCampusTransition = createOutdoorCampusTransitionPlanner(carletonCampus);

/** One planner contract powers Today, gaps, timetable and map route segments. */
export function createCarletonTransitionPlanner(): TransitionPlanner {
  return planOutdoorCampusTransition;
}

export async function getOutdoorCampusTransitionPlanner(
  universityId: string,
): Promise<TransitionPlanner | null> {
  switch (universityId) {
    case "carleton": {
      const { carletonCampus } = await import("@/universities/carleton/adapter");
      return createOutdoorCampusTransitionPlanner(carletonCampus);
    }
    case "tmu": {
      const { tmuCampus } = await import("@/universities/tmu/adapter");
      return createOutdoorCampusTransitionPlanner(tmuCampus);
    }
    case "queens": {
      const { queensCampus } = await import("@/universities/queens/adapter");
      return createOutdoorCampusTransitionPlanner(queensCampus);
    }
    case "laurier": {
      const { laurierCampus } = await import("@/universities/laurier/adapter");
      return createOutdoorCampusTransitionPlanner(laurierCampus);
    }
    default:
      return null;
  }
}

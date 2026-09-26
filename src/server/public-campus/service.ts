import { ROUTING_DEFAULTS, sanitizeRoutePreferences } from "../../config/routing.js";
import { assessGap } from "../../features/gaps/assess-gap.js";
import { sanitizeGapPreferences } from "../../features/gaps/preferences.js";
import type { GapPreferences } from "../../features/gaps/types.js";
import { findRoute } from "../../features/routing/engine.js";
import { routeBetweenBuildings } from "../../features/routing/campus-outdoor-graph.js";
import type {
  RoutePreferences,
  RouteResult,
  TransitionRoute,
} from "../../features/routing/types.js";
import type { UserPreferences } from "../../features/sync/preferences.js";
import type { Gap, Meeting, Term, Weekday } from "../../lib/timetable-types.js";
import {
  campusBuildingConfigurations,
  campusBuildingEntrances,
  getCampusBuildingIdentity,
} from "../../data/campuses/index.js";
import type { BuildingConfiguration } from "../../data/utm/building-registry.js";
import { resolveUniversityAndCampus, universityById } from "../../universities/registry.js";
import { getCampusSnapshot } from "./campus-snapshots.js";
import {
  PUBLIC_CAMPUS_DATA_VERSION,
  publicCampusBuildings,
  resolvePublicBuilding,
  serverRoutingGraph,
  type PublicCampusBuilding,
} from "./data.js";

export type PublicBuildingView = {
  code: string;
  name: string;
  category: PublicCampusBuilding["category"];
  aliases: string[];
  routingCoverage: PublicCampusBuilding["routingCoverage"];
  entranceCount: number;
  verifiedEntranceCount: number;
  accessibility: "accessible" | "not_accessible" | "unknown";
  indoorRoomNodeCount: number;
  provenance: Array<{
    source: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: "verified" | "inferred" | "unknown";
  }>;
  university?: string;
  campus?: string;
};

export type PublicRouteResponse = {
  dataVersion: string;
  from: PublicBuildingView;
  to: PublicBuildingView;
  preferences: RoutePreferences;
  status: "same-building" | "routed" | "approximate" | "unavailable";
  accuracy:
    | "Same building"
    | "Verified outdoor route, indoor estimate"
    | "Mapped campus path, indoor estimate"
    | "Approximate building-to-building estimate"
    | "Location unavailable";
  totalDistanceMeters: number | null;
  indoorDistanceMeters: number | null;
  outdoorDistanceMeters: number | null;
  estimatedSeconds: number | null;
  floorChanges: number | null;
  warnings: string[];
  routeVerification: "verified" | "mixed" | "inferred" | "unavailable";
};

export type PublicGapPlanResponse = {
  dataVersion: string;
  gap: {
    term: Term;
    weekday: Weekday;
    startTime: number;
    endTime: number;
    durationMinutes: number;
    from: PublicBuildingView;
    to: PublicBuildingView;
  };
  route: PublicRouteResponse;
  gapPreferences: GapPreferences;
  assessment: ReturnType<typeof assessGap>;
};

type PublicCampusError = {
  error: "unknown_building" | "ambiguous_building";
  message: string;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function buildingAccessibility(
  building: PublicCampusBuilding,
): PublicBuildingView["accessibility"] {
  if (building.entrances.some((entrance) => entrance.accessibility === "accessible")) {
    return "accessible";
  }
  if (
    building.entrances.length > 0 &&
    building.entrances.every((entrance) => entrance.accessibility === "not_accessible")
  ) {
    return "not_accessible";
  }
  return "unknown";
}

export function publicBuildingView(building: PublicCampusBuilding): PublicBuildingView {
  const provenance = unique(
    [
      ...(building.metadata ? [building.metadata] : []),
      ...building.entrances.map((entrance) => entrance.metadata),
    ].map((item) => JSON.stringify(item)),
  ).map((item) => JSON.parse(item) as PublicBuildingView["provenance"][number]);
  return {
    code: building.code,
    name: building.name,
    category: building.category,
    aliases: building.aliases,
    routingCoverage: building.routingCoverage,
    entranceCount: building.entrances.length,
    verifiedEntranceCount: building.entrances.filter(
      (entrance) => entrance.metadata.verificationStatus === "verified",
    ).length,
    accessibility: buildingAccessibility(building),
    indoorRoomNodeCount: building.indoorRoomNodeCount,
    provenance,
    university: "uoft",
    campus: "utm",
  };
}

export function externalBuildingView(
  building: BuildingConfiguration,
  campusId: string,
  universityId: string,
): PublicBuildingView {
  const entrances = campusBuildingEntrances(campusId, building.code);
  const isRoutable = universityById(universityId)?.routableCampuses.includes(campusId) ?? false;
  const provenance: PublicBuildingView["provenance"] =
    entrances.length > 0
      ? unique(
          entrances.map((e) =>
            JSON.stringify({
              source: e.metadata.source || "Gapwise Data",
              sourceUrl: e.metadata.sourceUrl || "",
              lastVerified: e.metadata.lastVerified || "",
              verificationStatus:
                e.metadata.verificationStatus === "verified" ? "verified" : "inferred",
            }),
          ),
        ).map((s) => JSON.parse(s))
      : [
          {
            source: "Gapwise Campus Directory",
            sourceUrl: "https://data.gapwise.ca",
            lastVerified: "2026-08-24T00:00:00Z",
            verificationStatus: "verified" as const,
          },
        ];

  const hasAccessible = entrances.some((e) => e.access === "public");
  const allRestricted = entrances.length > 0 && entrances.every((e) => e.access === "restricted");

  return {
    code: building.code,
    name: building.name,
    category: building.category,
    aliases: building.aliases ?? [],
    routingCoverage: isRoutable ? "mapped" : "identity-only",
    entranceCount: entrances.length,
    verifiedEntranceCount: entrances.filter((e) => e.metadata.verificationStatus === "verified")
      .length,
    accessibility: hasAccessible ? "accessible" : allRestricted ? "not_accessible" : "unknown",
    indoorRoomNodeCount: 0,
    provenance,
    university: universityId,
    campus: campusId,
  };
}

export function listPublicBuildings(options?: {
  university?: string;
  campus?: string;
}): PublicBuildingView[] {
  const resolved = resolveUniversityAndCampus(options?.university, options?.campus);
  if (!resolved) return [];
  if (resolved.campusId === "utm") {
    return publicCampusBuildings().map(publicBuildingView);
  }
  const configs = campusBuildingConfigurations(resolved.campusId);
  return configs.map((b) => externalBuildingView(b, resolved.campusId, resolved.university.id));
}

export function getPublicBuilding(
  query: string,
  options?: { university?: string; campus?: string },
) {
  const resolved = resolveUniversityAndCampus(options?.university, options?.campus);
  if (!resolved) return { status: "not_found" as const };
  if (resolved.campusId === "utm") {
    const resolution = resolvePublicBuilding(query);
    if (resolution.status === "found") {
      return { status: "found" as const, building: publicBuildingView(resolution.building) };
    }
    if (resolution.status === "ambiguous") {
      return {
        status: "ambiguous" as const,
        candidates: resolution.candidates.map(publicBuildingView),
      };
    }
    return { status: "not_found" as const };
  }

  const identity = getCampusBuildingIdentity(resolved.campusId, query);
  if (identity) {
    return {
      status: "found" as const,
      building: externalBuildingView(identity, resolved.campusId, resolved.university.id),
    };
  }
  return { status: "not_found" as const };
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: [number, number], b: [number, number]) {
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function verificationForRoute(route: RouteResult): PublicRouteResponse["routeVerification"] {
  const statuses = [
    ...route.nodes.map((node) => node.metadata?.verificationStatus).filter(Boolean),
    ...route.edges.map((edge) => edge.metadata?.verificationStatus).filter(Boolean),
  ];
  if (statuses.length === 0) return "inferred";
  if (statuses.every((status) => status === "verified")) return "verified";
  if (statuses.some((status) => status === "verified")) return "mixed";
  return "inferred";
}

function bestMappedRoute(
  from: PublicCampusBuilding,
  to: PublicCampusBuilding,
  preferences: RoutePreferences,
): RouteResult | null {
  const graph = serverRoutingGraph();
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const starts = from.entrances.filter((entrance) => nodeIds.has(entrance.routingNodeId));
  const ends = to.entrances.filter((entrance) => nodeIds.has(entrance.routingNodeId));
  const reviewedStart = starts.find((entrance) => entrance.preferredForRouting);
  const reviewedEnd = ends.find((entrance) => entrance.preferredForRouting);
  const preferredStarts = reviewedStart ? [reviewedStart] : starts;
  const preferredEnds = reviewedEnd ? [reviewedEnd] : ends;

  const chooseBest = (
    candidateStarts: typeof starts,
    candidateEnds: typeof ends,
  ): RouteResult | null => {
    let best: RouteResult | null = null;
    for (const start of candidateStarts) {
      for (const end of candidateEnds) {
        const route = findRoute(graph, start.routingNodeId, end.routingNodeId, preferences);
        if (!route) continue;
        if (
          !best ||
          route.estimatedSeconds < best.estimatedSeconds ||
          (route.estimatedSeconds === best.estimatedSeconds &&
            route.totalDistanceMeters < best.totalDistanceMeters)
        ) {
          best = route;
        }
      }
    }
    return best;
  };

  const preferred = chooseBest(preferredStarts, preferredEnds);
  if (preferred) return preferred;
  if (reviewedStart || reviewedEnd) return chooseBest(starts, ends);

  let best: RouteResult | null = null;
  for (const start of starts) {
    for (const end of ends) {
      const route = findRoute(graph, start.routingNodeId, end.routingNodeId, preferences);
      if (!route) continue;
      if (
        !best ||
        route.estimatedSeconds < best.estimatedSeconds ||
        (route.estimatedSeconds === best.estimatedSeconds &&
          route.totalDistanceMeters < best.totalDistanceMeters)
      ) {
        best = route;
      }
    }
  }
  return best;
}

export function routeBetweenPublicBuildings(input: {
  from: string;
  to: string;
  university?: string;
  campus?: string;
  preferences?: Partial<RoutePreferences> | null;
}): PublicRouteResponse | PublicCampusError {
  const resolved = resolveUniversityAndCampus(input.university, input.campus);
  if (!resolved) {
    return {
      error: "unknown_building",
      message: "The requested university or campus could not be resolved.",
    };
  }

  if (resolved.campusId === "utm") {
    const fromResolution = resolvePublicBuilding(input.from);
    const toResolution = resolvePublicBuilding(input.to);
    if (fromResolution.status === "ambiguous" || toResolution.status === "ambiguous") {
      return {
        error: "ambiguous_building",
        message:
          "A building name matched more than one canonical building. Use the canonical building code.",
      };
    }
    if (fromResolution.status !== "found" || toResolution.status !== "found") {
      return {
        error: "unknown_building",
        message:
          "Gapwise could not resolve one or both building names to a canonical campus building.",
      };
    }

    const from = fromResolution.building;
    const to = toResolution.building;
    const preferences = sanitizeRoutePreferences(input.preferences);
    const base = {
      dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
      from: publicBuildingView(from),
      to: publicBuildingView(to),
      preferences,
    };

    if (from.code === to.code) {
      return {
        ...base,
        status: "same-building",
        accuracy: "Same building",
        totalDistanceMeters: 0,
        indoorDistanceMeters: 0,
        outdoorDistanceMeters: 0,
        estimatedSeconds: 0,
        floorChanges: 0,
        warnings: [
          "Building identity matches, but this building-level route does not claim room-to-room indoor routing.",
        ],
        routeVerification: "verified",
      };
    }

    const mapped = bestMappedRoute(from, to, preferences);
    if (mapped) {
      return {
        ...base,
        status: "routed",
        accuracy:
          mapped.nodes.some((node) => node.kind === "room") ||
          mapped.edges.some((edge) => edge.environment === "indoor")
            ? "Verified outdoor route, indoor estimate"
            : "Mapped campus path, indoor estimate",
        totalDistanceMeters: mapped.totalDistanceMeters,
        indoorDistanceMeters: mapped.indoorDistanceMeters,
        outdoorDistanceMeters: mapped.outdoorDistanceMeters,
        estimatedSeconds: mapped.estimatedSeconds,
        floorChanges: mapped.floorChanges,
        warnings: unique([
          ...mapped.warnings,
          "Building-level routing ends at mapped building entrances; room-level indoor travel may be estimated separately.",
        ]),
        routeVerification: verificationForRoute(mapped),
      };
    }

    if (preferences.mode === "step-free") {
      return {
        ...base,
        status: "unavailable",
        accuracy: "Location unavailable",
        totalDistanceMeters: null,
        indoorDistanceMeters: null,
        outdoorDistanceMeters: null,
        estimatedSeconds: null,
        floorChanges: null,
        warnings: [
          "No fully accessible mapped route could be verified for this building pair. Gapwise will not invent a step-free route.",
        ],
        routeVerification: "unavailable",
      };
    }

    if (from.navigationPoint && to.navigationPoint) {
      const direct = distanceMeters(from.navigationPoint, to.navigationPoint);
      const approximateDistance = direct * 1.2;
      const approximateSeconds =
        approximateDistance / preferences.walkingSpeedMps +
        ROUTING_DEFAULTS.buildingEntryExitSeconds * 2;
      return {
        ...base,
        status: "approximate",
        accuracy: "Approximate building-to-building estimate",
        totalDistanceMeters: approximateDistance,
        indoorDistanceMeters: null,
        outdoorDistanceMeters: null,
        estimatedSeconds: approximateSeconds,
        floorChanges: null,
        warnings: [
          "No connected mapped campus path was available, so this is a conservative straight-line building estimate rather than a verified route.",
          "Accessibility is not verified for the estimated path.",
        ],
        routeVerification: "inferred",
      };
    }

    return {
      ...base,
      status: "unavailable",
      accuracy: "Location unavailable",
      totalDistanceMeters: null,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      estimatedSeconds: null,
      floorChanges: null,
      warnings: [
        "Gapwise does not have enough mapped data to estimate this building-to-building route.",
      ],
      routeVerification: "unavailable",
    };
  }

  // Multi-campus routing for other universities
  const fromIdentity = getCampusBuildingIdentity(resolved.campusId, input.from);
  const toIdentity = getCampusBuildingIdentity(resolved.campusId, input.to);
  if (!fromIdentity || !toIdentity) {
    return {
      error: "unknown_building",
      message: `Gapwise could not resolve one or both building names in ${resolved.university.shortName} (${resolved.campusId}).`,
    };
  }

  const preferences = sanitizeRoutePreferences(input.preferences);
  const fromView = externalBuildingView(fromIdentity, resolved.campusId, resolved.university.id);
  const toView = externalBuildingView(toIdentity, resolved.campusId, resolved.university.id);
  const base = {
    dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
    from: fromView,
    to: toView,
    preferences,
  };

  if (fromIdentity.code.toUpperCase() === toIdentity.code.toUpperCase()) {
    return {
      ...base,
      status: "same-building",
      accuracy: "Same building",
      totalDistanceMeters: 0,
      indoorDistanceMeters: 0,
      outdoorDistanceMeters: 0,
      estimatedSeconds: 0,
      floorChanges: 0,
      warnings: ["Both locations are in the same building."],
      routeVerification: "verified",
    };
  }

  const isRoutable = resolved.university.routableCampuses.includes(resolved.campusId);
  if (!isRoutable) {
    return {
      ...base,
      status: "unavailable",
      accuracy: "Location unavailable",
      totalDistanceMeters: null,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      estimatedSeconds: null,
      floorChanges: null,
      warnings: [
        `Pedestrian routing network is not yet available for ${resolved.university.shortName} ${resolved.campusId}; building directory and geometry coverage are available.`,
      ],
      routeVerification: "unavailable",
    };
  }

  const snapshot = getCampusSnapshot(resolved.campusId);
  if (!snapshot) {
    return {
      ...base,
      status: "unavailable",
      accuracy: "Location unavailable",
      totalDistanceMeters: null,
      indoorDistanceMeters: null,
      outdoorDistanceMeters: null,
      estimatedSeconds: null,
      floorChanges: null,
      warnings: ["Campus snapshot data not available."],
      routeVerification: "unavailable",
    };
  }

  const fromBuildingSnapshot = snapshot.buildings.find(
    (b) =>
      b.id === fromIdentity.code ||
      b.nativeCodes.some((code) => code.toUpperCase() === fromIdentity.code.toUpperCase()) ||
      b.name.toLowerCase() === fromIdentity.name.toLowerCase(),
  );
  const toBuildingSnapshot = snapshot.buildings.find(
    (b) =>
      b.id === toIdentity.code ||
      b.nativeCodes.some((code) => code.toUpperCase() === toIdentity.code.toUpperCase()) ||
      b.name.toLowerCase() === toIdentity.name.toLowerCase(),
  );

  if (!fromBuildingSnapshot || !toBuildingSnapshot) {
    return {
      error: "unknown_building",
      message: `Building geometry record not found for one or both locations in ${resolved.campusId}.`,
    };
  }

  const routeResult = routeBetweenBuildings(
    fromBuildingSnapshot.id,
    toBuildingSnapshot.id,
    snapshot,
    preferences.walkingSpeedMps,
  );

  if (routeResult.status === "ready") {
    return {
      ...base,
      status: "routed",
      accuracy: "Mapped campus path, indoor estimate",
      totalDistanceMeters: routeResult.distanceMeters,
      indoorDistanceMeters: 0,
      outdoorDistanceMeters: routeResult.distanceMeters,
      estimatedSeconds: routeResult.estimatedMinutes * 60,
      floorChanges: 0,
      warnings: [
        "Building-level routing ends at mapped building entrances; room-level indoor travel may be estimated separately.",
      ],
      routeVerification: "verified",
    };
  }

  return {
    ...base,
    status: "unavailable",
    accuracy: "Location unavailable",
    totalDistanceMeters: null,
    indoorDistanceMeters: null,
    outdoorDistanceMeters: null,
    estimatedSeconds: null,
    floorChanges: null,
    warnings: [routeResult.reason],
    routeVerification: "unavailable",
  };
}

function meetingForBoundary(input: {
  id: string;
  label: string;
  buildingCode: string;
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
}): Meeting {
  return {
    id: input.id,
    courseCode: input.label,
    activityType: "OTHER",
    sectionCode: "",
    courseName: input.label,
    startTime: input.startTime,
    endTime: input.endTime,
    weekday: input.weekday,
    buildingCode: input.buildingCode,
    room: null,
    term: input.term,
    locationUnknown: false,
    locationType: "physical",
  };
}

function transitionFromPublicRoute(route: PublicRouteResponse): TransitionRoute {
  if (route.status === "unavailable") {
    return {
      status: "unavailable",
      message: "Gapwise does not have a usable mapped route for this gap simulation.",
      accuracy: "Location unavailable",
      result: null,
      displayCoordinates: [],
      warnings: route.warnings,
      approximateDistanceMeters: null,
      approximateSeconds: null,
    };
  }
  if (route.status === "same-building") {
    return {
      status: "approximate",
      message: "Both boundaries are in the same building; room-to-room travel is not mapped.",
      accuracy: "Approximate building-to-building estimate",
      result: null,
      displayCoordinates: [],
      warnings: route.warnings,
      approximateDistanceMeters: 0,
      approximateSeconds: 0,
    };
  }
  const accuracy =
    route.accuracy === "Same building"
      ? "Approximate building-to-building estimate"
      : route.accuracy;
  return {
    status: route.status,
    message:
      route.status === "routed"
        ? "Route calculated along Gapwise's bundled campus paths."
        : "Approximate building-to-building estimate.",
    accuracy,
    result: null,
    displayCoordinates: [],
    warnings: route.warnings,
    approximateDistanceMeters: route.totalDistanceMeters,
    approximateSeconds: route.estimatedSeconds,
  };
}

function userRoutePreferences(route: PublicRouteResponse): UserPreferences {
  return {
    ...route.preferences,
    avoidStairs: route.preferences.mode === "step-free",
    preferIndoor: route.preferences.mode === "prefer-indoor",
    dayOrigin: "commute",
    mainCampus: "utm",
    residenceBuildingCode: null,
    commuteMode: null,
    campusAccessPointId: null,
  };
}

export function planPublicGap(input: {
  from: string;
  to: string;
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
  routePreferences?: Partial<RoutePreferences> | null;
  gapPreferences?: Partial<GapPreferences> | null;
}): PublicGapPlanResponse | PublicCampusError {
  const route = routeBetweenPublicBuildings({
    from: input.from,
    to: input.to,
    preferences: input.routePreferences ?? null,
  });
  if ("error" in route) return route;

  const previous = meetingForBoundary({
    id: "public-gap-origin",
    label: "Gap origin",
    buildingCode: route.from.code,
    term: input.term,
    weekday: input.weekday,
    startTime: Math.max(0, input.startTime - 60),
    endTime: input.startTime,
  });
  const next = meetingForBoundary({
    id: "public-gap-destination",
    label: "Gap destination",
    buildingCode: route.to.code,
    term: input.term,
    weekday: input.weekday,
    startTime: input.endTime,
    endTime: Math.min(1440, input.endTime + 60),
  });
  const gap: Gap = {
    id: "public-gap",
    term: input.term,
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes: input.endTime - input.startTime,
    previous,
    next,
  };
  const gapPreferences = sanitizeGapPreferences(input.gapPreferences);
  const assessment = assessGap({
    gap,
    route: transitionFromPublicRoute(route),
    routePreferences: userRoutePreferences(route),
    gapPreferences,
  });

  return {
    dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
    gap: {
      term: input.term,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: gap.durationMinutes,
      from: route.from,
      to: route.to,
    },
    route,
    gapPreferences,
    assessment,
  };
}

import type { CampusBuilding as Building, CampusSnapshot } from "@/data/campuses/contract";

export type RouteResult =
  | {
      status: "ready";
      coordinates: [number, number][];
      entranceIds: [string, string];
      distanceMeters: number;
      estimatedMinutes: number;
      fromBuilding: Building;
      toBuilding: Building;
    }
  | {
      status: "unavailable";
      reason: string;
      fromBuilding?: Building | null;
      toBuilding?: Building | null;
    };

export type BuildingAnchor = {
  buildingId: string;
  kind: "mapped-entrance" | "derived-perimeter";
  accessNodeId: string;
  entranceId: string;
  coordinate: [number, number];
  distanceToGraphMeters: number;
};

export function distanceMeters(a: [number, number], b: [number, number]): number {
  const radians = Math.PI / 180;
  const latitude = (b[1] - a[1]) * radians;
  const longitude = (b[0] - a[0]) * radians;
  const haversine =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(longitude / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

/**
 * Fast Min-Heap Priority Queue for Dijkstra / A* pathfinding.
 */
class MinHeap<T> {
  private data: Array<{ key: number; val: T }> = [];

  push(key: number, val: T) {
    this.data.push({ key, val });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): { key: number; val: T } | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.data.length;
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (this.data[idx]!.key < this.data[parentIdx]!.key) {
        const tmp = this.data[idx]!;
        this.data[idx] = this.data[parentIdx]!;
        this.data[parentIdx] = tmp;
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  private sinkDown(idx: number) {
    const len = this.data.length;
    while (true) {
      const left = (idx << 1) + 1;
      const right = left + 1;
      let smallest = idx;

      if (left < len && this.data[left]!.key < this.data[smallest]!.key) {
        smallest = left;
      }
      if (right < len && this.data[right]!.key < this.data[smallest]!.key) {
        smallest = right;
      }
      if (smallest !== idx) {
        const tmp = this.data[idx]!;
        this.data[idx] = this.data[smallest]!;
        this.data[smallest] = tmp;
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

type GraphEdge = {
  id: string;
  meters: number;
};

type CachedPath = {
  distanceMeters: number;
  coordinates: [number, number][];
  entranceIds: [string, string];
};

export class RoutingGraph {
  readonly campus: CampusSnapshot;
  readonly nodes: Map<string, [number, number]>;
  readonly adjacent: Map<string, GraphEdge[]>;
  readonly buildingIndex: Map<string, BuildingAnchor>;
  readonly routeCache: Map<string, CachedPath>;

  constructor(campus: CampusSnapshot) {
    this.campus = campus;
    this.nodes = new Map(campus.pathNodes.map((node) => [node.id, node.coordinate]));
    this.adjacent = new Map();
    this.buildingIndex = new Map();
    this.routeCache = new Map();

    // 1. Build adjacency list from outdoor pedestrian edges
    for (const edge of campus.pathEdges.filter((e) => e.mode === "outdoor-walk")) {
      const fromCoord = this.nodes.get(edge.from);
      const toCoord = this.nodes.get(edge.to);
      if (!fromCoord || !toCoord) continue;
      const meters = distanceMeters(fromCoord, toCoord);
      this.addEdge(edge.from, edge.to, meters);
      this.addEdge(edge.to, edge.from, meters);
    }

    // 2. Snap mapped entrances near the outdoor graph. These short inferred
    // links are for graph lookup; they are not evidence of an accessible doorway.
    const usableEntrances = campus.entrances.filter((e) => e.access !== "restricted");
    for (const entrance of usableEntrances) {
      const hasDirectEdge = (this.adjacent.get(entrance.pathNodeId)?.length ?? 0) > 0;
      if (!hasDirectEdge) {
        this.nodes.set(entrance.pathNodeId, entrance.coordinate);
        let nearestId: string | null = null;
        let minDist = Infinity;

        for (const [nodeId, coord] of this.nodes) {
          if (nodeId === entrance.pathNodeId) continue;
          if (!this.adjacent.has(nodeId)) continue;
          const d = distanceMeters(entrance.coordinate, coord);
          if (d < minDist) {
            minDist = d;
            nearestId = nodeId;
          }
        }

        if (nearestId && minDist <= 25) {
          this.addEdge(entrance.pathNodeId, nearestId, minDist);
          this.addEdge(nearestId, entrance.pathNodeId, minDist);
        }
      }
    }

    // 3. Precompute spatial grid for fast nearest-node lookups
    const GRID_SIZE = 0.001;
    const grid = new Map<string, Array<[string, [number, number]]>>();
    for (const [nid, coord] of this.nodes) {
      if (!this.adjacent.has(nid)) continue;
      const gx = Math.floor(coord[0] / GRID_SIZE);
      const gy = Math.floor(coord[1] / GRID_SIZE);
      const key = `${gx}:${gy}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push([nid, coord]);
    }

    // 4. Precompute building anchors: mapped entrance or inferred perimeter point.
    for (const b of campus.buildings) {
      const mappedEntrances = campus.entrances.filter((e) => e.buildingId === b.id);
      // A restricted-only facility must not regain a route through an inferred
      // perimeter anchor after its restricted entrance is filtered out.
      if (mappedEntrances.length > 0 && mappedEntrances.every((e) => e.access === "restricted"))
        continue;
      const bEntrances = usableEntrances.filter((e) => e.buildingId === b.id);
      if (bEntrances.length > 0) {
        const ent = bEntrances[0]!;
        this.buildingIndex.set(b.id, {
          buildingId: b.id,
          kind: "mapped-entrance",
          accessNodeId: ent.pathNodeId,
          entranceId: ent.id,
          coordinate: ent.coordinate,
          distanceToGraphMeters: 0,
        });
      } else {
        // Derive a representative perimeter point from the OSM building polygon.
        const rawCoords =
          b.geometry?.type === "Polygon"
            ? (b.geometry.coordinates[0] as [number, number][])
            : ((b.geometry?.coordinates as unknown as number[][][][])?.[0]?.[0] as [
                number,
                number,
              ][]);

        if (rawCoords && rawCoords.length > 0) {
          let bestVertex: [number, number] | null = null;
          let bestNodeId: string | null = null;
          let minD = Infinity;

          for (const vertex of rawCoords) {
            const gx = Math.floor(vertex[0] / GRID_SIZE);
            const gy = Math.floor(vertex[1] / GRID_SIZE);

            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const bucket = grid.get(`${gx + dx}:${gy + dy}`);
                if (!bucket) continue;
                for (const [nid, ncoord] of bucket) {
                  // Fast bounding box pre-filter before trigonometric haversine calculation
                  if (
                    Math.abs(vertex[0] - ncoord[0]) > 0.0009 ||
                    Math.abs(vertex[1] - ncoord[1]) > 0.0007
                  )
                    continue;
                  const d = distanceMeters(vertex, ncoord);
                  if (d < minD) {
                    minD = d;
                    bestVertex = vertex;
                    bestNodeId = nid;
                  }
                }
              }
            }
          }

          // Only infer an outdoor anchor when a source-backed path is within 60 meters.
          if (bestNodeId && bestVertex && minD <= 60) {
            this.buildingIndex.set(b.id, {
              buildingId: b.id,
              kind: "derived-perimeter",
              accessNodeId: bestNodeId,
              entranceId: `access-${b.id}`,
              coordinate: bestVertex,
              distanceToGraphMeters: minD,
            });
          }
        }
      }
    }
  }

  private addEdge(from: string, to: string, meters: number) {
    let list = this.adjacent.get(from);
    if (!list) {
      list = [];
      this.adjacent.set(from, list);
    }
    list.push({ id: to, meters });
  }

  getAnchor(buildingId: string): BuildingAnchor | null {
    return this.buildingIndex.get(buildingId) ?? null;
  }

  /**
   * Fast A* pathfinding using MinHeap and straight-line distance heuristic.
   */
  findPath(
    startNodeId: string,
    targetNodeId: string,
  ): { distanceMeters: number; coordinates: [number, number][] } | null {
    if (startNodeId === targetNodeId) {
      const coord = this.nodes.get(startNodeId);
      return coord ? { distanceMeters: 0, coordinates: [coord] } : null;
    }

    const targetCoord = this.nodes.get(targetNodeId);
    if (!targetCoord) return null;

    const gScore = new Map<string, number>([[startNodeId, 0]]);
    const prev = new Map<string, string>();
    const pq = new MinHeap<string>();

    const hStart = distanceMeters(this.nodes.get(startNodeId)!, targetCoord);
    pq.push(hStart, startNodeId);

    while (pq.size > 0) {
      const top = pq.pop();
      if (!top) break;
      const currentId = top.val;

      if (currentId === targetNodeId) {
        const pathCoords: [number, number][] = [];
        let curr: string | undefined = currentId;
        while (curr) {
          const c = this.nodes.get(curr);
          if (c) pathCoords.unshift(c);
          curr = prev.get(curr);
        }
        return { distanceMeters: gScore.get(targetNodeId)!, coordinates: pathCoords };
      }

      const currentG = gScore.get(currentId) ?? Infinity;
      const neighbors = this.adjacent.get(currentId);
      if (!neighbors) continue;

      for (const edge of neighbors) {
        const tentativeG = currentG + edge.meters;
        const recordedG = gScore.get(edge.id) ?? Infinity;

        if (tentativeG < recordedG) {
          gScore.set(edge.id, tentativeG);
          prev.set(edge.id, currentId);
          const neighborCoord = this.nodes.get(edge.id);
          const h = neighborCoord ? distanceMeters(neighborCoord, targetCoord) : 0;
          pq.push(tentativeG + h, edge.id);
        }
      }
    }

    return null;
  }
}

let cachedGraph: { campus: CampusSnapshot; graph: RoutingGraph } | null = null;

export function getRoutingGraph(campus: CampusSnapshot): RoutingGraph {
  if (cachedGraph && cachedGraph.campus === campus) {
    return cachedGraph.graph;
  }
  const graph = new RoutingGraph(campus);
  cachedGraph = { campus, graph };
  return graph;
}

export function getBuildingAnchor(
  buildingId: string,
  campus: CampusSnapshot,
): BuildingAnchor | null {
  const graph = getRoutingGraph(campus);
  return graph.getAnchor(buildingId);
}

/**
 * Returns a representative [longitude, latitude] coordinate for a building:
 * 1. An entrance coordinate if mapped.
 * 2. The derived perimeter access point connecting to the pedestrian graph.
 * 3. Centroid fallback.
 */
export function buildingRepresentativeCoordinate(
  building: Building,
  campus: CampusSnapshot,
): [number, number] | null {
  const graph = getRoutingGraph(campus);
  const anchor = graph.getAnchor(building.id);
  if (anchor) return anchor.coordinate;

  const entrance =
    campus.entrances.find((e) => e.buildingId === building.id && e.access !== "restricted") ??
    campus.entrances.find((e) => e.buildingId === building.id);
  if (entrance) return entrance.coordinate;

  if (building.geometry) {
    const rawCoords =
      building.geometry.type === "Polygon"
        ? (building.geometry.coordinates[0] as [number, number][])
        : ((building.geometry.coordinates as unknown as number[][][][])[0]?.[0] as [
            number,
            number,
          ][]);
    if (rawCoords && rawCoords.length > 0) {
      let sumLng = 0;
      let sumLat = 0;
      for (const coord of rawCoords) {
        sumLng += coord[0];
        sumLat += coord[1];
      }
      return [sumLng / rawCoords.length, sumLat / rawCoords.length];
    }
  }

  return null;
}

export function routeBetweenBuildings(
  fromBuildingId: string,
  toBuildingId: string,
  campus: CampusSnapshot,
  walkingSpeedMps = 1.33,
): RouteResult {
  const fromBuilding = campus.buildings.find((b) => b.id === fromBuildingId) ?? null;
  const toBuilding = campus.buildings.find((b) => b.id === toBuildingId) ?? null;

  if (!fromBuilding || !toBuilding) {
    return {
      status: "unavailable",
      reason: "A building location was not found in the mapped campus data.",
      fromBuilding,
      toBuilding,
    };
  }

  if (fromBuilding.id === toBuilding.id) {
    return {
      status: "unavailable",
      reason: `Both locations are in the same building (${fromBuilding.name}); indoor transitions are not mapped.`,
      fromBuilding,
      toBuilding,
    };
  }

  const graph = getRoutingGraph(campus);
  const fromAnchor = graph.getAnchor(fromBuilding.id);
  const toAnchor = graph.getAnchor(toBuilding.id);

  if (!fromAnchor || !toAnchor) {
    const missingName = !fromAnchor ? fromBuilding.name : toBuilding.name;
    return {
      status: "unavailable",
      reason: `${missingName} has no usable outdoor graph anchor in mapped campus data.`,
      fromBuilding,
      toBuilding,
    };
  }

  // Check in-memory route cache (keyed by anchor node pair)
  const cacheKey = `${fromAnchor.accessNodeId}:${toAnchor.accessNodeId}`;
  let cached = graph.routeCache.get(cacheKey);

  if (!cached) {
    const pathResult = graph.findPath(fromAnchor.accessNodeId, toAnchor.accessNodeId);
    if (!pathResult) {
      return {
        status: "unavailable",
        reason: `No mapped outdoor pedestrian path found between ${fromBuilding.name} and ${toBuilding.name}.`,
        fromBuilding,
        toBuilding,
      };
    }

    cached = {
      distanceMeters: Math.round(pathResult.distanceMeters),
      coordinates: pathResult.coordinates,
      entranceIds: [fromAnchor.entranceId, toAnchor.entranceId],
    };
    graph.routeCache.set(cacheKey, cached);
  }

  const speed = Math.max(0.5, walkingSpeedMps);
  const estimatedMinutes = Math.max(1, Math.round(cached.distanceMeters / (speed * 60)));

  return {
    status: "ready",
    coordinates: cached.coordinates,
    entranceIds: cached.entranceIds,
    distanceMeters: cached.distanceMeters,
    estimatedMinutes,
    fromBuilding,
    toBuilding,
  };
}

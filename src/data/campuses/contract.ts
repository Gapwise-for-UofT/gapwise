/** Runtime shape of a validated university campus snapshot from Gapwise Data. */
export type Coordinate = [longitude: number, latitude: number];

export interface CampusBuilding {
  id: string;
  name: string;
  nativeCodes: string[];
  aliases: string[];
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown[] } | null;
  provenance?: SourceReference[];
}

export interface SourceReference {
  sourceId: string;
  nativeId?: string | null;
  verification: "source-backed" | "field-reviewed" | "inferred";
}

export interface CampusSnapshot {
  schemaVersion: number;
  institution: string;
  campus: { id: string; name: string; bounds: [Coordinate, Coordinate] | null };
  sources: Array<{ id: string; attribution?: string; url?: string; licenseOrTerms?: string }>;
  buildings: CampusBuilding[];
  entrances: Array<{
    id: string;
    buildingId: string;
    coordinate: Coordinate;
    pathNodeId: string;
    access: "public" | "restricted" | "unknown";
    provenance?: SourceReference[];
  }>;
  pathNodes: Array<{ id: string; coordinate: Coordinate; provenance?: SourceReference[] }>;
  pathEdges: Array<{
    id: string;
    from: string;
    to: string;
    mode: "outdoor-walk" | "tunnel-walk";
    provenance?: SourceReference[];
  }>;
}

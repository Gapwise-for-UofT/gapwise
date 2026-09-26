import { getCampusBuildingIdentity } from "../../data/campuses/index.js";
import type { CampusPlace, CampusStateSnapshot } from "./types.js";

const RETRIEVED_AT = "2026-08-24T00:00:00Z";
const unknownHours = (sourceId: string) => ({
  sourceId,
  status: "unknown" as const,
  observedAt: RETRIEVED_AT,
  note: "Stable place identity is published, but current operating hours are not bundled; check the official source.",
});
const verified = (sourceId: string) => ({
  sourceId,
  status: "verified" as const,
  observedAt: RETRIEVED_AT,
});

export const CAMPUS_STATE_SNAPSHOT: CampusStateSnapshot = {
  schemaVersion: 1,
  version: "campus-state-2026-08-24",
  generatedAt: RETRIEVED_AT,
  sources: [
    {
      id: "utm-hospitality",
      name: "UTM Hospitality & Retail Services",
      url: "https://www.utm.utoronto.ca/hospitality/FoodLocations",
      kind: "official",
      retrievedAt: RETRIEVED_AT,
    },
    {
      id: "utm-library",
      name: "UTM Library",
      url: "https://library.utm.utoronto.ca/",
      kind: "official",
      retrievedAt: RETRIEVED_AT,
    },
    {
      id: "utm-athletics",
      name: "UTM Recreation, Athletics & Wellness",
      url: "https://www.utm.utoronto.ca/athletics/",
      kind: "official",
      retrievedAt: RETRIEVED_AT,
    },
  ],
  places: [
    {
      id: "davis-food-court",
      name: "Davis Food Court",
      kind: "dining",
      buildingCode: "DV",
      university: "uoft",
      campus: "utm",
      summary: "Dining options in the William G. Davis Building.",
      amenities: ["food"],
      hoursProvenance: unknownHours("utm-hospitality"),
      metadataProvenance: verified("utm-hospitality"),
      actions: [
        {
          label: "Official dining information",
          url: "https://www.utm.utoronto.ca/hospitality/FoodLocations",
          kind: "information",
        },
      ],
    },
    {
      id: "utm-library",
      name: "Hazel McCallion Academic Learning Centre",
      kind: "library",
      buildingCode: "HM",
      university: "uoft",
      campus: "utm",
      summary: "UTM's library and academic learning centre.",
      amenities: ["individual study", "group study", "library services"],
      hoursProvenance: unknownHours("utm-library"),
      metadataProvenance: verified("utm-library"),
      actions: [
        {
          label: "Library information and hours",
          url: "https://library.utm.utoronto.ca/",
          kind: "information",
        },
      ],
    },
    {
      id: "rawc",
      name: "Recreation, Athletics and Wellness Centre",
      kind: "recreation",
      buildingCode: "RAWC",
      university: "uoft",
      campus: "utm",
      summary: "Campus recreation, athletics and wellness facilities.",
      amenities: ["recreation", "fitness"],
      hoursProvenance: unknownHours("utm-athletics"),
      metadataProvenance: verified("utm-athletics"),
      actions: [
        {
          label: "Official RAWC information",
          url: "https://www.utm.utoronto.ca/athletics/",
          kind: "information",
        },
      ],
    },
  ],
  events: [],
  dynamicFacts: [],
};

function validateSnapshot(snapshot: CampusStateSnapshot) {
  const ids = new Set<string>();
  const sources = new Set(snapshot.sources.map((source) => source.id));
  for (const place of snapshot.places) {
    if (ids.has(place.id)) throw new Error(`Duplicate campus place id: ${place.id}`);
    ids.add(place.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(place.id))
      throw new Error(`Invalid campus place id: ${place.id}`);
    if (!getCampusBuildingIdentity(place.campus ?? "utm", place.buildingCode))
      throw new Error(`Unknown building for campus place ${place.id}`);
    if (
      !sources.has(place.metadataProvenance.sourceId) ||
      !sources.has(place.hoursProvenance.sourceId)
    )
      throw new Error(`Unknown source for campus place ${place.id}`);
    for (const action of place.actions ?? []) {
      const url = new URL(action.url);
      if (url.protocol !== "https:")
        throw new Error(`Unsafe action URL for campus place ${place.id}`);
    }
  }
}
validateSnapshot(CAMPUS_STATE_SNAPSHOT);

export function listCampusPlaces(options?: {
  university?: string;
  campus?: string;
}): readonly CampusPlace[] {
  if (options?.campus) {
    const campusId = options.campus.toLowerCase();
    return CAMPUS_STATE_SNAPSHOT.places.filter((p) => p.campus?.toLowerCase() === campusId);
  }
  if (options?.university) {
    const universityId = options.university.toLowerCase();
    return CAMPUS_STATE_SNAPSHOT.places.filter((p) => p.university?.toLowerCase() === universityId);
  }
  return CAMPUS_STATE_SNAPSHOT.places;
}

export function getCampusPlace(
  id: string,
  options?: { university?: string; campus?: string },
): CampusPlace | null {
  const place = CAMPUS_STATE_SNAPSHOT.places.find((p) => p.id === id) ?? null;
  if (!place) return null;
  if (options?.campus && place.campus?.toLowerCase() !== options.campus.toLowerCase()) return null;
  if (options?.university && place.university?.toLowerCase() !== options.university.toLowerCase())
    return null;
  return place;
}

export function getCampusSource(id: string) {
  return CAMPUS_STATE_SNAPSHOT.sources.find((source) => source.id === id) ?? null;
}

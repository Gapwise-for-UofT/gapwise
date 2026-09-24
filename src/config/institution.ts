export type GapwiseInstitutionId = "uoft" | "carleton";

export type GapwiseInstitutionConfig = {
  id: GapwiseInstitutionId;
  name: string;
  shortName: string;
  scopeLabel: string;
  campusHeading: string;
  logoMarkHref: string;
};

export const GAPWISE_INSTITUTIONS: Record<GapwiseInstitutionId, GapwiseInstitutionConfig> = {
  uoft: {
    id: "uoft",
    name: "University of Toronto",
    shortName: "U of T",
    scopeLabel: "U of T",
    campusHeading: "University of Toronto",
    logoMarkHref: "/logo-mark.svg",
  },
  carleton: {
    id: "carleton",
    name: "Carleton University",
    shortName: "Carleton",
    scopeLabel: "Carleton",
    campusHeading: "Carleton University",
    logoMarkHref: "/logo-mark-carleton.svg",
  },
};

function configuredInstitutionId(): GapwiseInstitutionId | null {
  const configured = String(import.meta.env?.VITE_GAPWISE_INSTITUTION ?? "")
    .trim()
    .toLowerCase();
  return configured === "uoft" || configured === "carleton" ? configured : null;
}

export function institutionIdForHostname(hostname: string): GapwiseInstitutionId {
  const configured = configuredInstitutionId();
  if (configured) return configured;

  const normalized = hostname.trim().toLowerCase().split(":")[0] ?? "";
  if (
    normalized === "carleton.gapwise.ca" ||
    normalized.startsWith("carleton.") ||
    normalized === "carleton.localhost"
  ) {
    return "carleton";
  }

  return "uoft";
}

export function currentInstitution(): GapwiseInstitutionConfig {
  if (typeof window === "undefined") return GAPWISE_INSTITUTIONS.uoft;
  return GAPWISE_INSTITUTIONS[institutionIdForHostname(window.location.hostname)];
}

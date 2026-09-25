import type { InstitutionAdapter } from "../common/model";

export const queens: InstitutionAdapter = {
  id: "queens",
  name: "Queen's University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    // Auto-insert space if 4 letters followed directly by 3-4 digits (e.g. CISC121 -> CISC 121)
    normalized = normalized.replace(/^([A-Z]{3,4})(\d{3}[A-Z]?)$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://my.queensu.ca",
  mapUrl: "https://www.queensu.ca/facilities/maps/campus-map",
};

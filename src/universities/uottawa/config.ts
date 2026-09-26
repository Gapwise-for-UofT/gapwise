import type { InstitutionAdapter } from "../common/model";

export const uottawa: InstitutionAdapter = {
  id: "uottawa",
  name: "University of Ottawa",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    normalized = normalized.replace(/^([A-Z]{3,4})(\d{4})$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://uozone.uottawa.ca",
  mapUrl: "https://www.uottawa.ca/about-us/maps",
};

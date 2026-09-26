import type { InstitutionAdapter } from "../common/model";

export const guelph: InstitutionAdapter = {
  id: "guelph",
  name: "University of Guelph",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    normalized = normalized.replace(/^([A-Z]{2,6})\*?(\d{4})$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -*]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://webadvisor.uoguelph.ca",
  mapUrl: "https://www.uoguelph.ca/maps/",
};

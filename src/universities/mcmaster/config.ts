import type { InstitutionAdapter } from "../common/model";

export const mcmaster: InstitutionAdapter = {
  id: "mcmaster",
  name: "McMaster University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    // Auto-insert space if 4-8 letters followed directly by digit (e.g. COMPSCI1MD3 -> COMPSCI 1MD3)
    normalized = normalized.replace(/^([A-Z]{3,8})(\d[A-Z0-9]{2,3})$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://mosaic.mcmaster.ca",
  mapUrl: "https://www.mcmaster.ca/welcome/campusmap.cfm",
};

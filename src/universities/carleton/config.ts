import type { InstitutionAdapter } from "./model";
export const carleton: InstitutionAdapter = {
  id: "carleton",
  name: "Carleton University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    // Auto-insert space if 4 letters followed directly by 4 digits (e.g. BUSI1004 -> BUSI 1004)
    normalized = normalized.replace(/^([A-Z]{4})(\d{4}[A-Z]?)$/, "$1 $2");
    // Published examples use four letters + four digits. Keep other native IDs
    // losslessly until the public schedule establishes a complete grammar.
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://central.carleton.ca/prod/bwysched.p_select_term?wsea_code=EXT",
  mapUrl: "https://carleton.ca/campus-map/",
};

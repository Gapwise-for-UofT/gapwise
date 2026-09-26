import type { InstitutionAdapter } from "../common/model";

export const york: InstitutionAdapter = {
  id: "york",
  name: "York University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    // Auto-insert space if 2-4 letters followed directly by 4 digits (e.g. EECS1022 -> EECS 1022)
    normalized = normalized.replace(/^([A-Z]{2,4})(\d{4}[A-Z]?)$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://registrar.yorku.ca/enrol/guide",
  mapUrl: "https://maps.info.yorku.ca/keele-campus/",
};

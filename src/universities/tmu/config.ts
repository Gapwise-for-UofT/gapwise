import type { InstitutionAdapter } from "../common/model";

export const tmu: InstitutionAdapter = {
  id: "tmu",
  name: "Toronto Metropolitan University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    // Auto-insert space if 3-4 letters followed directly by 3 digits (e.g. CPS109 -> CPS 109)
    normalized = normalized.replace(/^([A-Z]{2,4})(\d{3}[A-Z]?)$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://www.torontomu.ca/servicehub/",
  mapUrl: "https://www.torontomu.ca/maps/",
};

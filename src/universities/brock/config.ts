import type { InstitutionAdapter } from "../common/model";

export const brock: InstitutionAdapter = {
  id: "brock",
  name: "Brock University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    normalized = normalized.replace(/^([A-Z]{3,4})(\d[A-Z]\d{2})$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://my.brocku.ca",
  mapUrl: "https://brocku.ca/facilities-management/campus-maps/",
};

import type { InstitutionAdapter } from "../common/model";

export const laurier: InstitutionAdapter = {
  id: "laurier",
  name: "Wilfrid Laurier University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    // Auto-insert space if 2-4 letters followed directly by 3 digits (e.g. CP104 -> CP 104, BU111 -> BU 111)
    normalized = normalized.replace(/^([A-Z]{2,4})(\d{3}[A-Z]?)$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://web.wlu.ca/student-portal/",
  mapUrl: "https://www.wlu.ca/about/campuses-and-locations/waterloo-campus/maps.html",
};

import type { InstitutionAdapter } from "../common/model";

export const western: InstitutionAdapter = {
  id: "western",
  name: "Western University",
  parseCourseCode(value) {
    let normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    normalized = normalized.replace(/^([A-Z]{2,8})(\d[A-Z0-9]{2,4})$/, "$1 $2");
    return /^[A-Z][A-Z0-9 -]{2,31}$/.test(normalized) ? normalized : null;
  },
  sectionLabel: "Section",
  componentLabel: "Component",
  publicScheduleUrl: "https://student.uwo.ca",
  mapUrl: "https://www.uwo.ca/about/visit/maps.html",
};

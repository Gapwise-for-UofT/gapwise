import manifest from "../../universities.json";

export type University = (typeof manifest.universities)[number];

export function validateUniversityManifest(
  entries: readonly University[] = manifest.universities,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const hosts = new Set<string>();
  const campusIds = new Set<string>();
  for (const entry of entries) {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id) || ids.has(entry.id))
      errors.push(`Invalid or duplicate university ID: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.name.trim() || !entry.shortName.trim()) errors.push(`${entry.id}: name is required`);
    if (!entry.campuses.length || !entry.campuses.includes(entry.defaultCampus))
      errors.push(`${entry.id}: default campus must be listed`);
    if (entry.routableCampuses.some((campus) => !entry.campuses.includes(campus)))
      errors.push(`${entry.id}: routable campus must be listed`);
    if (!entry.timetableAdapter.trim()) errors.push(`${entry.id}: timetable adapter is required`);
    if (!entry.accentColor?.trim() || !/^#[0-9a-fA-F]{6}$/.test(entry.accentColor))
      errors.push(`${entry.id}: valid hex accentColor is required`);
    if (!entry.campusScope?.trim()) errors.push(`${entry.id}: campusScope is required`);
    if (entry.status !== "planned" && !entry.dataPaths.length)
      errors.push(`${entry.id}: data paths are required`);
    for (const campus of entry.campuses) {
      if (campusIds.has(campus)) errors.push(`Duplicate campus ID: ${campus}`);
      campusIds.add(campus);
    }
    for (const host of entry.hosts) {
      if (host !== host.toLowerCase() || !/^[a-z0-9.-]+$/.test(host) || hosts.has(host))
        errors.push(`Invalid or duplicate host: ${host}`);
      hosts.add(host);
    }
  }
  return errors;
}

export function universityById(id: string): University | null {
  return manifest.universities.find((entry) => entry.id === id) ?? null;
}

export function isPreviewOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "gapwise.test" ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".gapwise.test")
  );
}

export function universityForHostname(
  hostname: string,
  override?: string | null,
): University | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const local = host === "localhost" || host === "127.0.0.1" || host === "gapwise.test";
  const preview = host.endsWith(".vercel.app");
  if (override && (local || preview)) return universityById(override);
  if (local || preview) return universityById("uoft");
  if (host.endsWith(".gapwise.test")) return universityById(host.slice(0, -".gapwise.test".length));
  return manifest.universities.find((entry) => entry.hosts.includes(host)) ?? null;
}

export function activeUniversity(): University | null {
  if (typeof window === "undefined") return universityById("uoft");
  const host = window.location.hostname;
  const isPreviewOrDev = isPreviewOrLocalHost(host);
  const requested = new URLSearchParams(window.location.search).get("university");
  let override: string | null = null;
  if (isPreviewOrDev) {
    try {
      if (requested) window.sessionStorage.setItem("gapwise:dev-university", requested);
      override = requested ?? window.sessionStorage.getItem("gapwise:dev-university");
    } catch {
      override = requested;
    }
  }
  return universityForHostname(host, override);
}

export function campusesForUniversity(university: University): string[] {
  return university.campuses;
}

export function universityByCampus(campusId: string): University | null {
  const normalized = campusId.toLowerCase();
  return (
    manifest.universities.find(
      (entry) =>
        entry.campuses.some((c) => c.toLowerCase() === normalized) ||
        (entry.id === "laurier" && normalized === "laurier") ||
        (entry.id === "york" && normalized === "york") ||
        (entry.id === "mcmaster" && normalized === "main"),
    ) ?? null
  );
}

export function allCampuses() {
  return manifest.universities.flatMap((uni) =>
    uni.campuses.map((campusId) => ({
      id: campusId,
      universityId: uni.id,
      name:
        campusId === "utm"
          ? "University of Toronto Mississauga"
          : campusId === "utsg"
            ? "University of Toronto St. George"
            : campusId === "utsc"
              ? "University of Toronto Scarborough"
              : uni.name,
      shortName:
        campusId === "utm"
          ? "UTM"
          : campusId === "utsg"
            ? "UTSG"
            : campusId === "utsc"
              ? "UTSC"
              : uni.shortName,
      routable: uni.routableCampuses.includes(campusId),
      defaultForUniversity: uni.defaultCampus === campusId,
      status: uni.status,
    })),
  );
}

export function resolveUniversityAndCampus(
  queryUniversity?: string | null,
  queryCampus?: string | null,
): { university: University; campusId: string } | null {
  if (queryCampus) {
    const uni = universityByCampus(queryCampus);
    if (!uni) return null;
    const normalized = queryCampus.toLowerCase();
    const actualCampus =
      uni.campuses.find((c) => c.toLowerCase() === normalized) ??
      (normalized === "laurier"
        ? "waterloo"
        : normalized === "york"
          ? "keele"
          : normalized === "main"
            ? "mcmaster"
            : uni.defaultCampus);
    return { university: uni, campusId: actualCampus };
  }
  if (queryUniversity) {
    const uni = universityById(queryUniversity.toLowerCase());
    if (!uni) return null;
    return { university: uni, campusId: uni.defaultCampus };
  }
  const defaultUni = universityById("uoft")!;
  return { university: defaultUni, campusId: "utm" };
}

export function supportedUniversities(): University[] {
  return manifest.universities.filter((entry) => entry.status === "supported");
}

export function canonicalUrlForUniversity(uni: University): string {
  return `https://${uni.hosts[0]}`;
}

export function urlForUniversity(uni: University): string {
  if (typeof window === "undefined") return `https://${uni.hosts[0]}`;
  const host = window.location.hostname.toLowerCase();
  const isPreview = isPreviewOrLocalHost(host);
  if (isPreview) {
    const url = new URL(window.location.href);
    url.searchParams.set("university", uni.id);
    return url.toString();
  }
  return `https://${uni.hosts[0]}`;
}

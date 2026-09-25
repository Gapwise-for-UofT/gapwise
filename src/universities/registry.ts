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

export function supportedUniversities(): University[] {
  return manifest.universities.filter((entry) => entry.status === "supported");
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

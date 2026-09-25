import { readFile } from "node:fs/promises";

function requireText(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) throw new Error(`${label} is missing ${needle}`);
}

function requireEntity(
  graph: Array<Record<string, unknown>>,
  id: string,
  type: string,
): Record<string, unknown> {
  const entity = graph.find((item) => item["@id"] === id);
  if (!entity || entity["@type"] !== type) {
    throw new Error(`homepage structured data is missing ${type} ${id}`);
  }
  return entity;
}

function requireReference(
  entity: Record<string, unknown>,
  property: string,
  targetId: string,
  label: string,
) {
  const reference = entity[property];
  if (
    typeof reference !== "object" ||
    reference === null ||
    (reference as Record<string, unknown>)["@id"] !== targetId
  ) {
    throw new Error(`${label} must reference ${targetId}`);
  }
}

const [home, sitemap, robots] = await Promise.all([
  readFile("dist/index.html", "utf8"),
  readFile("dist/sitemap.xml", "utf8"),
  readFile("dist/robots.txt", "utf8"),
]);

for (const needle of [
  '<meta property="og:site_name" content="Gapwise"',
  '<meta property="og:image:width" content="1200"',
  '<meta property="og:image:height" content="630"',
  '<meta name="twitter:card" content="summary_large_image"',
  '"@type":"WebSite"',
  '"@type":"Organization"',
  '"name":"Gapwise"',
  "https://github.com/Gapwise-for-UofT",
])
  requireText(home, needle, "homepage metadata");

const structuredDataMatch = home.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
const structuredDataJson = structuredDataMatch?.[1];
if (!structuredDataJson) throw new Error("homepage is missing JSON-LD structured data");

const structuredData = JSON.parse(structuredDataJson) as {
  "@context"?: unknown;
  "@graph"?: unknown;
};
if (structuredData["@context"] !== "https://schema.org") {
  throw new Error("homepage structured data must use the Schema.org context");
}
if (!Array.isArray(structuredData["@graph"])) {
  throw new Error("homepage structured data must contain an entity graph");
}

const graph = structuredData["@graph"] as Array<Record<string, unknown>>;
const organizationId = "https://gapwise.ca/#organization";
const appId = "https://gapwise.ca/#app";
const founderId = "https://gapwise.ca/#andrew-muratov";
const organization = requireEntity(graph, organizationId, "Organization");
const app = requireEntity(graph, appId, "WebApplication");
const founder = requireEntity(graph, founderId, "Person");

requireReference(organization, "founder", founderId, "Gapwise founder");
requireReference(app, "creator", founderId, "Gapwise creator");
requireReference(app, "publisher", organizationId, "Gapwise publisher");

if (founder["name"] !== "Andrew Muratov") {
  throw new Error("homepage Person entity must identify Andrew Muratov");
}
if (founder["url"] !== "https://www.donotdisconnect.online/") {
  throw new Error("homepage Person entity must use Andrew Muratov's canonical portfolio URL");
}
for (const profile of [
  "https://github.com/andrewmuratov",
  "https://www.linkedin.com/in/andrewmuratov",
]) {
  if (!Array.isArray(founder["sameAs"]) || !founder["sameAs"].includes(profile)) {
    throw new Error(`homepage Person entity is missing authoritative profile ${profile}`);
  }
}

for (const needle of [
  "Gapwise was created by",
  '<a href="https://www.donotdisconnect.online/">Andrew Muratov</a>',
  '<a href="https://github.com/Gapwise-for-UofT/gapwise">Gapwise is open source on GitHub</a>',
])
  requireText(home, needle, "homepage crawlable creator attribution");

for (const path of [
  "/about",
  "/utm-timetable",
  "/campus-map",
  "/gap-planner",
  "/campus-routing",
  "/acorn-import",
]) {
  requireText(sitemap, `<loc>https://gapwise.ca${path}</loc>`, "sitemap");
}

for (const privatePath of ["/today", "/timetable", "/gaps", "/oauth/"]) {
  if (sitemap.includes(`<loc>https://gapwise.ca${privatePath}`)) {
    throw new Error(`private/stateful path leaked into sitemap: ${privatePath}`);
  }
}
requireText(robots, "Disallow: /_seo/", "robots.txt");
requireText(robots, "Disallow: /api/", "robots.txt");
requireText(robots, "Disallow: /oauth/", "robots.txt");
requireText(robots, "Sitemap: https://gapwise.ca/sitemap.xml", "robots.txt");

// ── Per-university sitemap and robots regression checks ──────────────────────

/** U of T-specific paths that must NEVER appear in non-UofT university sitemaps. */
const UOFT_ONLY_PATHS = [
  "/utm-timetable",
  "/acorn-import",
  "/places",
  "/places/davis-food-court",
  "/places/utm-library",
  "/places/rawc",
];

const UNIVERSITY_IDS = ["carleton", "tmu", "queens", "laurier"] as const;
type UniversityId = (typeof UNIVERSITY_IDS)[number];
const UNIVERSITY_ORIGINS: Record<UniversityId, string> = {
  carleton: "https://carleton.gapwise.ca",
  tmu: "https://tmu.gapwise.ca",
  queens: "https://queens.gapwise.ca",
  laurier: "https://laurier.gapwise.ca",
};

for (const uniId of UNIVERSITY_IDS) {
  const uniOrigin = UNIVERSITY_ORIGINS[uniId];
  const uniSitemapPath = `dist/_universities/${uniId}/sitemap.xml`;
  const uniRobotsPath = `dist/_universities/${uniId}/robots.txt`;
  const uniHtmlPath = `dist/_universities/${uniId}/index.html`;

  const [uniSitemap, uniRobots, uniHtml] = await Promise.all([
    readFile(uniSitemapPath, "utf8"),
    readFile(uniRobotsPath, "utf8"),
    readFile(uniHtmlPath, "utf8"),
  ]);

  // Sitemap must be valid XML with urlset
  if (!uniSitemap.includes("<urlset")) {
    throw new Error(`${uniId} sitemap is missing <urlset>`);
  }

  // Sitemap must contain the university's own origin
  requireText(uniSitemap, uniOrigin, `${uniId} sitemap`);

  // Sitemap must NOT contain gapwise.ca (U of T) URLs
  if (uniSitemap.includes("https://gapwise.ca")) {
    throw new Error(
      `${uniId} sitemap contains gapwise.ca — university sitemaps must use their own hostname`,
    );
  }

  // Sitemap must NOT contain other universities' hostnames
  for (const otherId of UNIVERSITY_IDS) {
    if (otherId === uniId) continue;
    if (uniSitemap.includes(UNIVERSITY_ORIGINS[otherId])) {
      throw new Error(
        `${uniId} sitemap contains ${otherId} hostname — each sitemap must only contain its own university URLs`,
      );
    }
  }

  // Sitemap must NOT contain U of T-specific paths
  for (const path of UOFT_ONLY_PATHS) {
    if (uniSitemap.includes(path)) {
      throw new Error(
        `${uniId} sitemap contains U of T-specific path ${path} — this path must not appear in non-UofT university sitemaps`,
      );
    }
  }

  // Sitemap must contain at least the homepage URL
  requireText(uniSitemap, `<loc>${uniOrigin}/</loc>`, `${uniId} sitemap`);

  // Robots.txt must reference the university's own sitemap
  requireText(uniRobots, `Sitemap: ${uniOrigin}/sitemap.xml`, `${uniId} robots.txt`);

  // University HTML must have canonical URL pointing to the university origin (not gapwise.ca)
  if (uniHtml.includes(`rel="canonical" href="https://gapwise.ca`)) {
    throw new Error(
      `${uniId} index.html has canonical URL pointing to gapwise.ca — must use ${uniOrigin}`,
    );
  }

  // University HTML must have OG URL pointing to the university origin
  if (uniHtml.includes(`property="og:url" content="https://gapwise.ca`)) {
    throw new Error(
      `${uniId} index.html has og:url pointing to gapwise.ca — must use ${uniOrigin}`,
    );
  }

  // University HTML must have JSON-LD with the university origin (not gapwise.ca/#organization etc.)
  if (uniHtml.includes(`"https://gapwise.ca/#`)) {
    throw new Error(
      `${uniId} index.html has JSON-LD entity IDs still pointing to gapwise.ca — must use ${uniOrigin}`,
    );
  }
}

console.log("Generated SEO output verified.");
console.log(
  `Verified per-university sitemaps, robots.txt, canonical URLs, OG URLs, and JSON-LD for: ${UNIVERSITY_IDS.join(", ")}.`,
);

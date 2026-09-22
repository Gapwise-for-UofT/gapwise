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

console.log("Generated SEO output verified.");

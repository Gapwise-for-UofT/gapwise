import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PUBLIC_FEATURE_PAGES } from "../src/content/public-feature-pages";

const SITE_ORIGIN = "https://gapwise.ca";
const GITHUB_ORGANIZATION = "https://github.com/GapwiseHQ";
const GITHUB_CORE = `${GITHUB_ORGANIZATION}/gapwise`;

export type UniversityContext = {
  id: string;
  name: string;
  shortName: string;
  origin: string;
  routable: boolean;
};

export const UOFT_CONTEXT: UniversityContext = {
  id: "uoft",
  name: "University of Toronto",
  shortName: "U of T",
  origin: SITE_ORIGIN,
  routable: true,
};

function socialImageUrl(uniContext?: UniversityContext) {
  const origin = uniContext?.origin ?? SITE_ORIGIN;
  const id = uniContext?.id ?? "uoft";
  return `${origin}/universities/${id}/og-card.png`;
}

type SeoSection = { title: string; body: string; bullets?: readonly string[] };
type SeoPage = {
  path: string;
  title: string;
  description: string;
  heading: string;
  detail: string;
  sections?: readonly SeoSection[];
  sitemap: boolean;
};

const FEATURE_PAGES: readonly SeoPage[] = Object.values(PUBLIC_FEATURE_PAGES).map((page) => ({
  path: page.path,
  title: page.seoTitle,
  description: page.description,
  heading: page.title,
  detail: page.lead,
  sections: page.sections,
  sitemap: true,
}));

const PAGES: readonly SeoPage[] = [
  {
    path: "/",
    title: "Gapwise — University of Toronto",
    description:
      "Gapwise is a free and open-source timetable, campus navigation, and student planning platform for University of Toronto students. Also available for Carleton, TMU, Queen's, and Laurier.",
    heading: "Make the time between classes count.",
    detail:
      "Import an ACORN .ics timetable in your browser, preserve UTM, UTSG, UTSC, or mixed-campus context, understand the usable time between classes, and explore source-backed campus maps. Pedestrian routing is currently available for UTM. Guest mode and a demo work without an account.",
    sections: [
      {
        title: "Your timetable, connected to campus context",
        body: "Gapwise combines class times, rooms, campus identity, available deterministic travel time, and gap budgets so the schedule can answer more than when the next class begins.",
      },
      {
        title: "Private by architecture",
        body: "The original timetable file is parsed locally in the browser. Private sync is optional, public campus data stays separate from private student state, and foreground location is not retained as a movement history.",
      },
      {
        title: "Algorithms where correctness matters",
        body: "Gap durations, leave-by times, route selection, and other computable values use deterministic code. Optional AI interfaces are bounded to the places where interpretation is actually useful.",
      },
    ],
    sitemap: true,
  },
  ...FEATURE_PAGES,
  {
    path: "/places",
    title: "UTM Campus Places — Gapwise",
    description:
      "Explore source-backed UTM dining, study, service, library, and recreation places with explicit freshness and conservative handling of unknown hours.",
    heading: "Practical places at UTM, with source-backed details.",
    detail:
      "Gapwise keeps place identity, source provenance, and freshness explicit. Missing live hours stay unknown instead of being guessed as open or closed.",
    sitemap: true,
  },
  {
    path: "/places/davis-food-court",
    title: "Davis Food Court at UTM — Gapwise",
    description:
      "Source-backed location and practical details for Davis Food Court in the William G. Davis Building at UTM.",
    heading: "Davis Food Court at UTM",
    detail:
      "Gapwise records this dining location in the William G. Davis Building and links back to the official UTM Hospitality source for current information.",
    sitemap: true,
  },
  {
    path: "/places/utm-library",
    title: "UTM Library — Hazel McCallion Academic Learning Centre | Gapwise",
    description:
      "Source-backed location and practical details for UTM's Hazel McCallion Academic Learning Centre and library.",
    heading: "UTM Library and Hazel McCallion Academic Learning Centre",
    detail:
      "Gapwise records the library as a source-backed campus place for individual study, group study, and library services, while leaving unbundled current hours unknown.",
    sitemap: true,
  },
  {
    path: "/places/rawc",
    title: "UTM RAWC — Recreation, Athletics & Wellness | Gapwise",
    description:
      "Source-backed location and practical details for UTM's Recreation, Athletics and Wellness Centre (RAWC).",
    heading: "UTM Recreation, Athletics and Wellness Centre",
    detail:
      "Gapwise records RAWC as a source-backed recreation and fitness destination and links to the official UTM athletics source for current information.",
    sitemap: true,
  },
  {
    path: "/developers",
    title: "Gapwise API & SDKs — Developers",
    description:
      "Build with the Gapwise public UTM building, place, routing, and deterministic gap-planning API, OpenAPI contract, and official SDKs.",
    heading: "Deterministic UTM campus intelligence for developers.",
    detail:
      "Gapwise publishes a bounded public API for UTM buildings, places, routing, and gap planning, with OpenAPI plus JavaScript/TypeScript and Python SDK documentation.",
    sitemap: true,
  },
  {
    path: "/ai",
    title: "Gapwise AI — Connect Gapwise to AI Assistants",
    description:
      "Connect explicitly delegated Gapwise timetable context and deterministic UTM campus intelligence to compatible AI assistants through Gapwise's secure remote MCP service.",
    heading: "Your Gapwise context, with an assistant you choose.",
    detail:
      "Gapwise AI exposes public campus intelligence plus narrowly delegated timetable, availability, gap-planning, and compatibility-scoped planning capabilities. Academic meetings remain read-only and AI access can be revoked.",
    sitemap: true,
  },
  {
    path: "/support",
    title: "Support — Gapwise",
    description:
      "Support for Gapwise accounts, timetables, AI connectors, privacy, security, revocation, and troubleshooting.",
    heading: "Help with Gapwise.",
    detail:
      "Find first-party guidance for connector authorization, missing schedule context, rejected writes, revocation, privacy, security reporting, and service status.",
    sitemap: true,
  },
  {
    path: "/trust",
    title: "Trust Center — Gapwise",
    description:
      "Evidence-backed privacy, security, accessibility, data-flow, AI permission, incident-response, and independence information for Gapwise.",
    heading: "Gapwise Trust Center",
    detail:
      "Review implementation-backed privacy and security boundaries, accessibility evidence, incident processes, subprocessors, AI permissions, and open items that still require human or provider confirmation.",
    sitemap: true,
  },
  {
    path: "/privacy",
    title: "Privacy — Gapwise",
    description:
      "How Gapwise handles timetable, account, planning, AI, analytics, and foreground location data, including browser-local ACORN parsing.",
    heading: "Privacy at Gapwise",
    detail:
      "The original ACORN .ics file is parsed in the browser. Guest mode is first-class, private cloud sync is optional, and precise live location is foreground-only when requested.",
    sitemap: true,
  },
  {
    path: "/security",
    title: "Vulnerability Disclosure — Gapwise",
    description:
      "How to report a suspected Gapwise security vulnerability privately and safely, including the preferred private reporting path.",
    heading: "Report a Gapwise security issue privately.",
    detail:
      "Gapwise publishes a vulnerability disclosure policy and canonical security.txt. Do not place exploit details, credentials, tokens, or private student data in public issues.",
    sitemap: true,
  },
  {
    path: "/accessibility",
    title: "Accessibility — Gapwise",
    description:
      "Gapwise's accessibility target, current automated and keyboard-test evidence, known limitations, and feedback path.",
    heading: "Accessibility is an ongoing Gapwise practice.",
    detail:
      "Gapwise uses WCAG 2.2 Level AA as a product and review target while clearly separating current automated evidence from manual or independent assessment that has not occurred.",
    sitemap: true,
  },
  {
    path: "/terms",
    title: "Terms — Gapwise",
    description:
      "Terms and important notices for the independent Gapwise timetable, gap-planning, and campus-routing application for University of Toronto students.",
    heading: "Gapwise terms and notices",
    detail:
      "Gapwise is an independent student project. Review the current product terms and notices without implying University of Toronto approval or endorsement.",
    sitemap: false,
  },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function canonicalUrl(path: string, origin: string = SITE_ORIGIN) {
  return new URL(path, `${origin}/`).href;
}

function outputPath(path: string) {
  if (path === "/") return "_seo/index.html";
  return `_seo/${path.slice(1).replaceAll("/", "--")}.html`;
}

function homepageStructuredData(page: SeoPage, uniContext?: UniversityContext) {
  const origin = uniContext?.origin ?? SITE_ORIGIN;
  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;
  const appId = `${origin}/#app`;
  const founderId = `${origin}/#andrew-muratov`;
  const uniName = uniContext ? uniContext.name : null;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Gapwise",
        url: `${origin}/`,
        description: uniName
          ? `Privacy-first timetable intelligence, campus maps, and day planning for ${uniName} students.`
          : "Privacy-first timetable intelligence, campus maps, and day planning for university students across Canada. Supports University of Toronto, Carleton University, TMU, Queen's University, and Wilfrid Laurier University.",
        logo: {
          "@type": "ImageObject",
          url: `${origin}/icon-512.png`,
          width: 512,
          height: 512,
        },
        founder: { "@id": founderId },
        email: "support@gapwise.ca",
        sameAs: [GITHUB_ORGANIZATION],
      },
      {
        "@type": "Person",
        "@id": founderId,
        name: "Andrew Muratov",
        url: "https://www.donotdisconnect.online/",
        description:
          "University of Toronto student, creator of Gapwise, and the project's lead engineer.",
        sameAs: ["https://github.com/andrewmuratov", "https://www.linkedin.com/in/andrewmuratov"],
        knowsAbout: [
          "Gapwise",
          "Computer science",
          "Information security",
          "Mathematics",
          "Software engineering",
        ],
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: uniName ? `Gapwise — ${uniName}` : "Gapwise",
        url: `${origin}/`,
        description: page.description,
        inLanguage: "en-CA",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebApplication",
        "@id": appId,
        name: uniName ? `Gapwise — ${uniName}` : "Gapwise",
        url: `${origin}/`,
        description: page.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        inLanguage: "en-CA",
        creator: { "@id": founderId },
        publisher: { "@id": organizationId },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CAD",
        },
        audience: {
          "@type": "Audience",
          audienceType: uniName
            ? `University students at ${uniName}`
            : "University students at University of Toronto, Carleton University, Toronto Metropolitan University, Queen's University, and Wilfrid Laurier University",
        },
        featureList: uniName
          ? [
              `Browser-local timetable import for ${uniName}`,
              `Campus timetable identity`,
              `Source-backed building maps for ${uniName}`,
              ...(uniContext?.routable ? [`Source-backed campus pedestrian routing`] : []),
              "Optional encrypted private sync",
            ]
          : [
              "Browser-local timetable import (ACORN .ics, Carleton Central, TMU, Queen's, Laurier schedule formats)",
              "UTM, UTSG, UTSC, Carleton, TMU, Queen's, and Laurier campus timetable identity",
              "Source-backed building maps for all 5 supported universities",
              "Source-backed UTM pedestrian routing",
              "Optional encrypted private sync",
            ],
        sameAs: [GITHUB_CORE],
      },
    ],
  };
}

function metadata(page: SeoPage, uniContext?: UniversityContext) {
  const effectiveUni = uniContext ?? UOFT_CONTEXT;
  const origin = effectiveUni.origin;
  const canonical = canonicalUrl(page.path, origin);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const socialImage = socialImageUrl(effectiveUni);
  const socialImageAlt = `Gapwise — ${escapeHtml(effectiveUni.name)}`;
  const schema =
    page.path === "/"
      ? `\n    <script type="application/ld+json">${JSON.stringify(homepageStructuredData(page, effectiveUni)).replaceAll("<", "\\u003c")}</script>`
      : "";

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="application-name" content="Gapwise" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Gapwise" />
    <meta property="og:locale" content="en_CA" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${socialImage}" />
    <meta property="og:image:secure_url" content="${socialImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${socialImageAlt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${socialImage}" />
    <meta name="twitter:image:alt" content="${socialImageAlt}" />${schema}`;
}

function fallback(page: SeoPage, uniContext?: UniversityContext) {
  const links = uniContext
    ? ([
        ["/", "Gapwise home"],
        ["/about", "About Gapwise"],
        ["/campus-map", "Campus map"],
        ["/gap-planner", "Gap planner"],
        ["/campus-routing", "Campus routing"],
        ["/developers", "Developer API and SDKs"],
        ["/ai", "Gapwise AI"],
        ["/support", "Support"],
        ["/trust", "Trust Center"],
        ["/privacy", "Privacy"],
        ["/security", "Security"],
        ["/accessibility", "Accessibility"],
      ] as const)
    : ([
        ["/", "Gapwise home"],
        ["/about", "About Gapwise"],
        ["/utm-timetable", "UTM timetable"],
        ["/gap-planner", "Gap planner"],
        ["/campus-map", "Campus map"],
        ["/campus-routing", "Campus routing"],
        ["/acorn-import", "ACORN import"],
        ["/places", "UTM campus places"],
        ["/developers", "Developer API and SDKs"],
        ["/ai", "Gapwise AI"],
        ["/support", "Support"],
        ["/trust", "Trust Center"],
        ["/privacy", "Privacy"],
        ["/security", "Security"],
        ["/accessibility", "Accessibility"],
      ] as const);

  const navigation = links
    .map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join(" · ");
  const sections = (page.sections ?? [])
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>${
          section.bullets?.length
            ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
            : ""
        }</section>`,
    )
    .join("\n");

  const disclaimer = uniContext
    ? `Gapwise is an independent student project for students at ${escapeHtml(uniContext.name)}. It is not an official service of ${escapeHtml(uniContext.name)} and does not claim university approval, sponsorship, or endorsement.`
    : `Gapwise is an independent student project for students at the University of Toronto, Carleton University, Toronto Metropolitan University, Queen's University, and Wilfrid Laurier University. It is not an official service of any of these institutions and does not claim university approval, sponsorship, or endorsement.`;

  return `<main data-gapwise-search-fallback style="max-width:60rem;margin:0 auto;padding:3rem 1.25rem;font-family:system-ui,sans-serif;line-height:1.65">
      <p><strong>Gapwise</strong> — Timetable &amp; Campus Navigation</p>
      <h1>${escapeHtml(page.heading)}</h1>
      <p>${escapeHtml(page.description)}</p>
      <p>${escapeHtml(page.detail)}</p>
      ${page.path === "/" ? '<p>Gapwise was created by <a href="https://www.donotdisconnect.online/">Andrew Muratov</a>, a University of Toronto student and the lead engineer of the project. <a href="https://github.com/GapwiseHQ/gapwise">Gapwise is open source on GitHub</a>.</p>' : ""}
      ${sections}
      <p>${disclaimer}</p>
      <nav aria-label="Gapwise public pages">${navigation}</nav>
    </main>`;
}

function renderDocument(baseHtml: string, page: SeoPage, uniContext?: UniversityContext) {
  if (!baseHtml.includes("</head>")) throw new Error("Built index is missing </head>.");
  if (!/<div id="root"><\/div>/.test(baseHtml))
    throw new Error("Built index is missing the empty #root mount point.");

  let html = baseHtml
    .replace("</head>", `${metadata(page, uniContext)}\n  </head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${fallback(page, uniContext)}</div>`);

  if (uniContext) {
    html = html
      .replace(/href="\/logo-mark\.svg"/g, `href="/universities/${uniContext.id}/logo-mark.svg"`)
      .replace(
        /href="\/favicon-192x192\.png"/g,
        `href="/universities/${uniContext.id}/favicon-192x192.png"`,
      )
      .replace(
        /href="\/favicon-32x32\.png"/g,
        `href="/universities/${uniContext.id}/favicon-32x32.png"`,
      )
      .replace(
        /href="\/favicon-16x16\.png"/g,
        `href="/universities/${uniContext.id}/favicon-16x16.png"`,
      )
      .replace(
        /href="\/apple-touch-icon\.png"/g,
        `href="/universities/${uniContext.id}/apple-touch-icon.png"`,
      )
      .replace(
        /href="\/site\.webmanifest"/g,
        `href="/universities/${uniContext.id}/site.webmanifest"`,
      );
  }

  return html;
}

/** Pages available on every university edition (no U of T-specific content). */
const UNIVERSITY_COMMON_PATHS = new Set([
  "/",
  "/about",
  "/campus-map",
  "/gap-planner",
  "/campus-routing",
  "/developers",
  "/ai",
  "/support",
  "/trust",
  "/privacy",
  "/security",
  "/accessibility",
]);

function getUniversityPage(page: SeoPage, uni: UniversityContext): SeoPage {
  if (page.path === "/") {
    return {
      path: "/",
      title: `Gapwise — ${uni.name}`,
      description: `Gapwise is a free and open-source timetable, campus navigation, and student planning platform for ${uni.name} students.`,
      heading: "Make the time between classes count.",
      detail:
        "Import your class schedule, understand the usable time between classes, and explore source-backed campus maps. Guest mode and a demo work without an account.",
      sections: [
        {
          title: "Your timetable, connected to campus context",
          body: "Gapwise combines class times, rooms, campus identity, available deterministic travel time, and gap budgets so the schedule can answer more than when the next class begins.",
        },
        {
          title: "Private by architecture",
          body: "The original timetable file is parsed locally in the browser. Private sync is optional, public campus data stays separate from private student state, and foreground location is not retained as a movement history.",
        },
        {
          title: "Algorithms where correctness matters",
          body: "Gap durations, leave-by times, route selection, and other computable values use deterministic code. Optional AI interfaces are bounded to the places where interpretation is actually useful.",
        },
      ],
      sitemap: true,
    };
  }
  if (page.path === "/about") {
    return {
      ...page,
      title: `About Gapwise — ${uni.name}`,
      description: `See how Gapwise connects ${uni.name} timetables, gap planning, and source-backed campus context in one focused student-built product.`,
    };
  }
  if (page.path === "/campus-map") {
    return {
      ...page,
      title: `${uni.name} Campus Map — Gapwise`,
      description: `Explore source-backed campus building maps for ${uni.name} — with schedule context and pedestrian routing where supported.`,
      detail: `The Gapwise campus explorer connects ${uni.name} buildings and schedule context.`,
    };
  }
  if (page.path === "/gap-planner") {
    return {
      ...page,
      title: `${uni.name} Gap Planner — Gapwise`,
      description: `See usable time between ${uni.name} classes after supported travel, transition buffers, setup, pack-up, meals, and campus context with Gapwise.`,
    };
  }
  if (page.path === "/campus-routing") {
    return {
      ...page,
      title: `${uni.name} Campus Routing — Gapwise`,
      description: `Plan routes between supported ${uni.name} campus buildings with travel time, distance, and timetable context in Gapwise.`,
    };
  }
  if (page.path === "/developers") {
    return {
      ...page,
      title: `Gapwise API & SDKs — Developers`,
      description: `Build with the Gapwise public campus building, place, routing, and deterministic gap-planning API, OpenAPI contract, and official SDKs.`,
      heading: `Deterministic campus intelligence for developers.`,
      detail: `Gapwise publishes a bounded public API for campus buildings, places, routing, and gap planning, with OpenAPI plus JavaScript/TypeScript and Python SDK documentation.`,
    };
  }
  if (page.path === "/privacy") {
    return {
      ...page,
      description: `How Gapwise handles timetable, account, planning, AI, analytics, and foreground location data for ${uni.name} students.`,
      detail: `The original schedule file is parsed in the browser. Guest mode is first-class, private cloud sync is optional, and precise live location is foreground-only when requested.`,
    };
  }
  return page;
}

function renderSitemap(origin: string = SITE_ORIGIN, paths?: Set<string>) {
  const urls = PAGES.filter((page) => page.sitemap && (!paths || paths.has(page.path)))
    .map((page) => `  <url><loc>${new URL(page.path, `${origin}/`).href}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderRobotsTxt(sitemapUrl: string) {
  return `User-agent: *\nAllow: /\nDisallow: /_seo/\nDisallow: /api/\nDisallow: /v1\nDisallow: /oauth/\n\nSitemap: ${sitemapUrl}\n`;
}

const distIndexPath = join("dist", "index.html");
const baseHtml = await readFile(distIndexPath, "utf8");

for (const page of PAGES) {
  const destination = join("dist", outputPath(page.path));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, renderDocument(baseHtml, page, UOFT_CONTEXT));
}

const expectedSitemap = renderSitemap();
const committedSitemap = await readFile(join("public", "sitemap.xml"), "utf8");
if (committedSitemap !== expectedSitemap) {
  throw new Error("public/sitemap.xml is out of sync with the production SEO page inventory.");
}
await writeFile(join("dist", "_seo", "sitemap.xml"), expectedSitemap);
await writeFile(
  join("dist", "_seo", "robots.txt"),
  await readFile(join("public", "robots.txt"), "utf8"),
);

// Write U of T tenant entry point and sitemap/robots
const uoftTenantDir = join("dist", "_universities", "uoft");
await mkdir(uoftTenantDir, { recursive: true });
const uoftHomeHtml = renderDocument(baseHtml, PAGES[0]!, UOFT_CONTEXT);
await writeFile(join(uoftTenantDir, "index.html"), uoftHomeHtml);
await writeFile(join(uoftTenantDir, "sitemap.xml"), expectedSitemap);
await writeFile(
  join(uoftTenantDir, "robots.txt"),
  await readFile(join("public", "robots.txt"), "utf8"),
);

const universitiesManifest = JSON.parse(await readFile("universities.json", "utf8"));
let universityCount = 0;
const universityPageCounts: Record<string, number> = {};

for (const uni of universitiesManifest.universities) {
  if (uni.id === "uoft") continue;

  const uniOrigin = `https://${uni.hosts[0]}`;
  const uniContext: UniversityContext = {
    id: uni.id,
    name: uni.name,
    shortName: uni.shortName,
    origin: uniOrigin,
    routable: Boolean(uni.enabledFeatures?.routing),
  };

  const uniSitemapUrl = `${uniOrigin}/sitemap.xml`;
  const uniSitemap = renderSitemap(uniOrigin, UNIVERSITY_COMMON_PATHS);
  const uniRobots = renderRobotsTxt(uniSitemapUrl);

  const tenantDir = join("dist", "_universities", uni.id);
  const tenantSeoDir = join(tenantDir, "_seo");
  await mkdir(tenantSeoDir, { recursive: true });

  const commonPages = PAGES.filter((p) => UNIVERSITY_COMMON_PATHS.has(p.path));
  for (const page of commonPages) {
    const uniPage = getUniversityPage(page, uniContext);
    const html = renderDocument(baseHtml, uniPage, uniContext);
    if (page.path === "/") {
      await writeFile(join(tenantDir, "index.html"), html);
    } else {
      const fileName = `${page.path.slice(1).replaceAll("/", "--")}.html`;
      await writeFile(join(tenantSeoDir, fileName), html);
    }
  }

  await writeFile(join(tenantDir, "sitemap.xml"), uniSitemap);
  await writeFile(join(tenantDir, "robots.txt"), uniRobots);

  const uniPageCount = commonPages.filter((p) => p.sitemap).length;
  universityPageCounts[uni.id] = uniPageCount;
  universityCount++;
}

// Remove root files so they cannot shadow host-specific rewrites on Vercel
await rm(join("dist", "index.html"), { force: true });
await rm(join("dist", "sitemap.xml"), { force: true });
await rm(join("dist", "robots.txt"), { force: true });
await rm(join("dist", "og-gapwise.png"), { force: true });
await rm(join("dist", "og-card.png"), { force: true });

const uoftPageCount = PAGES.filter((p) => p.sitemap).length;
console.log(
  `Generated ${PAGES.length} crawlable Gapwise HTML entry points and ${uoftPageCount} U of T sitemap URLs.`,
);
console.log(
  `Generated per-university sitemap + robots.txt for ${universityCount} university editions: ${Object.entries(
    universityPageCounts,
  )
    .map(([id, n]) => `${id}(${n})`)
    .join(", ")}.`,
);

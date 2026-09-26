import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

type CardConfig = {
  outputPath: string;
  accentColor: string;
  textColor: string;
  title: string;
  tagline: string;
  detail: string;
};

const DEER_PATH = `
<g transform="translate(90, 188) scale(${220 / 554}) translate(-350, -315)">
  <defs>
    <path id="upper-left" d="M627 638 540 534c-21-19-47-32-75-49-47-29-68-77-68-132h31c2 32 13 63 34 87 6 6 12 12 20 18-3-14-3-27-1-39 2-13 6-24 12-33l25 13c-7 15-10 30-8 42 1 17 7 29 15 37 7 8 13 12 19 15l83 37Z"/>
    <path id="lower-left" d="M627 692 522 558c-18-19-40-33-59-39-15-1-31-1-48-1 0 30 11 56 36 76 17 12 35 16 74 16v120c0 8 3 14 8 20l72 100c5 7 12 10 22 10Z"/>
  </defs>
  <g fill="%%ACCENT_COLOR%%">
    <use href="#upper-left"/>
    <use href="#upper-left" transform="translate(1254 0) scale(-1 1)"/>
    <use href="#lower-left"/>
    <use href="#lower-left" transform="translate(1254 0) scale(-1 1)"/>
  </g>
</g>
`;

function escapeXml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderSvg(config: CardConfig): string {
  const deer = DEER_PATH.replace("%%ACCENT_COLOR%%", config.accentColor);
  const titleSize = config.title.length > 14 ? 70 : config.title.length > 8 ? 78 : 92;
  const titleY = config.title.length > 14 ? 250 : config.title.length > 8 ? 256 : 264;

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0B1118"/>
  <rect x="0" y="0" width="1200" height="8" fill="${config.accentColor}"/>
  ${deer}
  <text x="365" y="${titleY}" fill="#F7FAFC" font-family="DejaVu Sans, Liberation Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="${titleSize}" font-weight="700" letter-spacing="-1">${escapeXml(config.title)}</text>
  <text x="370" y="338" fill="#B7C3D0" font-family="DejaVu Sans, Liberation Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="400">${escapeXml(config.tagline)}</text>
  <text x="372" y="404" fill="${config.textColor}" font-family="DejaVu Sans, Liberation Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="26" font-weight="600">${escapeXml(config.detail)}</text>
</svg>
`;
}

const CARDS: CardConfig[] = [
  // ── Universities ──────────────────────────────────────────
  {
    outputPath: "public/universities/uoft/og-card.png",
    accentColor: "#4EA7FE",
    textColor: "#93c5fd",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "University of Toronto",
  },
  {
    outputPath: "public/universities/carleton/og-card.png",
    accentColor: "#E31B23",
    textColor: "#fca5a5",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "Carleton University",
  },
  {
    outputPath: "public/universities/tmu/og-card.png",
    accentColor: "#0284c7",
    textColor: "#7dd3fc",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "Toronto Metropolitan University",
  },
  {
    outputPath: "public/universities/queens/og-card.png",
    accentColor: "#f59e0b",
    textColor: "#fcd34d",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "Queen's University",
  },
  {
    outputPath: "public/universities/laurier/og-card.png",
    accentColor: "#8b5cf6",
    textColor: "#c4b5fd",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "Wilfrid Laurier University",
  },
  {
    outputPath: "public/universities/york/og-card.png",
    accentColor: "#E31837",
    textColor: "#fca5a5",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "York University",
  },
  {
    outputPath: "public/universities/mcmaster/og-card.png",
    accentColor: "#7A003C",
    textColor: "#f472b6",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "McMaster University",
  },
  // ── Root fallbacks (U of T default) ──────────────────────
  {
    outputPath: "public/og-card.png",
    accentColor: "#4EA7FE",
    textColor: "#93c5fd",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "University of Toronto",
  },
  {
    outputPath: "public/og-gapwise.png",
    accentColor: "#4EA7FE",
    textColor: "#93c5fd",
    title: "Gapwise",
    tagline: "Make the time between classes count.",
    detail: "University of Toronto",
  },
  // ── Supporting Sites ──────────────────────────────────────
  {
    outputPath: "../data/public/og-card.png",
    accentColor: "#00d2ff",
    textColor: "#67e8f9",
    title: "Gapwise Data",
    tagline: "Canada's largest free campus navigation dataset.",
    detail: "Building geometry, entrances, accessibility & path networks",
  },
  {
    outputPath: "../docs/public/og-card.png",
    accentColor: "#38bdf8",
    textColor: "#7dd3fc",
    title: "Gapwise Developers",
    tagline: "Official documentation, API contracts, and SDKs.",
    detail: "JavaScript/TypeScript & Python SDKs · REST API",
  },
  {
    outputPath: "../status/public/og-card.png",
    accentColor: "#22c55e",
    textColor: "#86efac",
    title: "Gapwise Status",
    tagline: "Real-time service status and operational uptime.",
    detail: "All systems operational · Live health metrics",
  },
  {
    outputPath: "../ai/public/og-card.png",
    accentColor: "#a855f7",
    textColor: "#d8b4fe",
    title: "Gapwise AI",
    tagline: "Permissioned AI & MCP campus intelligence.",
    detail: "Deterministic campus context for AI assistants",
  },
];

for (const card of CARDS) {
  const target = resolve(import.meta.dirname, "..", card.outputPath);
  await mkdir(dirname(target), { recursive: true });
  const svg = renderSvg(card);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(target, png);
  console.log(`Generated social card: ${card.outputPath} (${png.length} bytes)`);
}

console.log(`Successfully generated all ${CARDS.length} social preview cards.`);

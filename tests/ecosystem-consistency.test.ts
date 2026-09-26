import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "../universities.json";
import { timetableAdapters, demoTimetableLoaders } from "@/universities/timetable-adapters";
import {
  supportedUniversities,
  universityById,
  universityForHostname,
} from "@/universities/registry";

const EXPECTED_UNIVERSITY_IDS = [
  "uoft",
  "carleton",
  "tmu",
  "queens",
  "laurier",
  "york",
  "mcmaster",
  "western",
  "guelph",
  "uottawa",
  "brock",
] as const;

describe("Gapwise Ecosystem Consistency", () => {
  test("canonical registry contains exactly the 11 supported universities", () => {
    expect(manifest.universities.length).toBe(11);
    const ids = manifest.universities.map((u) => u.id);
    for (const expectedId of EXPECTED_UNIVERSITY_IDS) {
      expect(ids).toContain(expectedId);
    }
  });

  test("every university resolves via hostname and ID", () => {
    for (const uni of manifest.universities) {
      expect(universityById(uni.id)).not.toBeNull();
      for (const host of uni.hosts) {
        expect(universityForHostname(host)?.id).toBe(uni.id);
        expect(universityForHostname(host.toUpperCase())?.id).toBe(uni.id);
      }
    }
  });

  test("every university has campus catalog and campus data", () => {
    for (const uni of manifest.universities) {
      if (uni.id === "uoft") continue;
      const campusFile = resolve(`src/data/campuses/${uni.id}/campus.json`);
      const catalogFile = resolve(`src/data/campuses/${uni.id}/catalog.json`);
      expect(existsSync(campusFile)).toBe(true);
      expect(existsSync(catalogFile)).toBe(true);

      const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
      expect(catalog.buildings.length).toBeGreaterThanOrEqual(10);
      expect(catalog.entrances.length).toBeGreaterThanOrEqual(10);
    }
  });

  test("every university has an adapter and demo loader registered", () => {
    for (const uni of manifest.universities) {
      const adapterKey = uni.timetableAdapter;
      expect(adapterKey).toBeDefined();
      expect(typeof timetableAdapters[adapterKey]).toBe("function");
      expect(typeof demoTimetableLoaders[adapterKey]).toBe("function");
    }
  });

  test("every university has complete web assets (logo, manifest, og-card, icons)", () => {
    for (const uni of manifest.universities) {
      const dir = resolve(`public/universities/${uni.id}`);
      expect(existsSync(resolve(dir, "logo-mark.svg"))).toBe(true);
      expect(existsSync(resolve(dir, "site.webmanifest"))).toBe(true);
      expect(existsSync(resolve(dir, "og-card.png"))).toBe(true);
      expect(existsSync(resolve(dir, "icon-192.png"))).toBe(true);
      expect(existsSync(resolve(dir, "icon-512.png"))).toBe(true);
      expect(existsSync(resolve(dir, "favicon-16x16.png"))).toBe(true);
      expect(existsSync(resolve(dir, "favicon-32x32.png"))).toBe(true);
      expect(existsSync(resolve(dir, "apple-touch-icon.png"))).toBe(true);
    }
  });

  test("vercel.json includes rewrites for every non-uoft university hostname", () => {
    const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
    const rewrites = vercelConfig.rewrites as Array<{
      source: string;
      has?: Array<{ type: string; value: string }>;
      destination: string;
    }>;

    for (const expectedId of EXPECTED_UNIVERSITY_IDS) {
      if (expectedId === "uoft") continue;
      const expectedHost = `${expectedId}.gapwise.ca`;
      const matchingRewrites = rewrites.filter((r) =>
        r.has?.some((h) => h.type === "host" && h.value === expectedHost),
      );
      expect(matchingRewrites.length).toBeGreaterThanOrEqual(6);
    }
  });

  test("marketing landing metrics and UI showcase all 11 universities", () => {
    const marketingCode = readFileSync("src/components/MarketingLandingImpl.tsx", "utf8");
    for (const expectedId of EXPECTED_UNIVERSITY_IDS) {
      expect(marketingCode).toContain(`${expectedId}: {`);
    }
  });

  test("data repository includes all 11 universities in campus-contribution-data.js", () => {
    const dataContributionCode = readFileSync("../data/src/campus-contribution-data.js", "utf8");
    for (const expectedId of EXPECTED_UNIVERSITY_IDS) {
      expect(dataContributionCode).toContain(`id: '${expectedId}'`);
    }
  });

  test("docs repository guides and platform docs list all 11 universities", () => {
    const guideCode = readFileSync("../docs/src/content/docs/guides/add-university.md", "utf8");
    const ecosystemDoc = readFileSync("../docs/src/content/docs/platform/ecosystem.md", "utf8");
    for (const expectedId of EXPECTED_UNIVERSITY_IDS) {
      expect(guideCode).toContain(
        expectedId === "uoft" ? "gapwise.ca" : `${expectedId}.gapwise.ca`,
      );
      expect(ecosystemDoc).toContain(
        expectedId === "uoft" ? "gapwise.ca" : `${expectedId}.gapwise.ca`,
      );
    }
  });

  test("status repository automatic checks cover all 11 universities", () => {
    const statusScript = readFileSync("../status/scripts/update-status.mjs", "utf8");
    for (const expectedId of EXPECTED_UNIVERSITY_IDS) {
      const url =
        expectedId === "uoft" ? "https://gapwise.ca/" : `https://${expectedId}.gapwise.ca/`;
      expect(statusScript).toContain(url);
    }
  });
});

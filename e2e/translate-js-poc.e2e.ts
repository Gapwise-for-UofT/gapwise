import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const fixtureDirectory = path.resolve("research/translate-js-poc");
const localOrigin = "http://translate-js-poc.test";
const originalCopy = "Find a quiet study space.";

async function openFixture(
  page: import("@playwright/test").Page,
  options: { failTranslation?: boolean } = {},
) {
  const translationPayloads: string[] = [];
  const unexpectedRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === localOrigin) {
      const file = ["/", "/public-view"].includes(url.pathname)
        ? "index.html"
        : url.pathname.slice(1);
      const content = await readFile(path.join(fixtureDirectory, file));
      const contentType = file.endsWith(".html") ? "text/html" : "application/javascript";
      await route.fulfill({ status: 200, contentType, body: content });
      return;
    }
    if (url.hostname === "edge.microsoft.com" && url.pathname === "/translate/translatetext") {
      const payload = route.request().postData() ?? "";
      translationPayloads.push(payload);
      if (options.failTranslation) {
        await route.fulfill({ status: 503, body: "unavailable" });
        return;
      }
      const texts = JSON.parse(payload) as string[];
      const language = url.searchParams.get("to") ?? "fr";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          texts.map(() => ({ translations: [{ text: language === "fr" ? "Bonjour" : "Hola" }] })),
        ),
      });
      return;
    }
    unexpectedRequests.push(url.href);
    await route.abort();
  });
  await page.goto(localOrigin);
  return { translationPayloads, unexpectedRequests };
}

test("synthetic public copy switches, persists, and excludes identifiers and outside text", async ({
  page,
}) => {
  const requests = await openFixture(page);
  const selector = page.getByRole("combobox", { name: "Display language" });
  await expect(selector).toHaveValue("english");
  await expect(page.locator("#sample-copy")).toHaveText(originalCopy);
  expect(requests.translationPayloads).toHaveLength(0);
  await page.keyboard.press("Tab");
  await expect(selector).toBeFocused();

  await selector.selectOption("french");
  await expect(page.locator("#sample-copy")).toContainText("Bonjour");
  await expect(page.locator("#outside-scope")).toContainText("MAT157H5");
  await expect(page.locator("#public-copy code")).toHaveText("CSC110Y5");
  await expect(page.locator("#public-copy .notranslate").first()).toHaveText("MN");
  await page.getByRole("button", { name: "Add synthetic public text" }).click();
  await expect(page.locator("#dynamic-copy")).toContainText("Bonjour");

  await page.getByRole("button", { name: "Open synthetic public view" }).click();
  await expect(page).toHaveURL(`${localOrigin}/public-view`);
  await expect(page.locator("#sample-copy")).toContainText("Bonjour");

  await page.reload();
  await expect(selector).toHaveValue("french");
  await expect(page.locator("#sample-copy")).toContainText("Bonjour");
  await selector.selectOption("english");
  await expect(page.locator("#sample-copy")).toHaveText(originalCopy);
  expect(requests.translationPayloads.join(" ")).not.toContain("MAT157H5");
  expect(requests.translationPayloads.join(" ")).not.toContain("CSC110Y5");
  expect(requests.translationPayloads.join(" ")).not.toContain("MN");
  expect(requests.unexpectedRequests).toEqual([]);
});

test("translation service failure restores English source text and selector state", async ({
  page,
}) => {
  const requests = await openFixture(page, { failTranslation: true });
  const selector = page.getByRole("combobox", { name: "Display language" });
  await selector.selectOption("spanish");
  await expect(page.getByRole("status")).toContainText("Translation unavailable");
  await expect(selector).toHaveValue("english");
  await expect(page.locator("#sample-copy")).toHaveText(originalCopy);
  expect(requests.translationPayloads.length).toBeGreaterThan(0);
  expect(requests.unexpectedRequests).toEqual([]);
});

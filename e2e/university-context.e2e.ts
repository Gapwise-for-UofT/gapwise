import { expect, test } from "@playwright/test";
import { watchForAppFailures } from "./helpers";

test("Carleton uses the canonical product screens and campus dataset", async ({
  page,
  baseURL,
}) => {
  test.skip(!["chromium", "mobile-chromium"].includes(test.info().project.name));
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const failures = watchForAppFailures(page, baseURL);

  await page.goto("/?university=carleton");
  await expect(page.getByText("For Carleton University", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import Carleton" })).toBeVisible();
  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page.getByText("DEMO 1001").first()).toBeVisible();
  await expect(page).toHaveURL(/\/timetable/);

  if (test.info().project.name === "mobile-chromium") {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Map" }).click();
  } else {
    await page
      .getByRole("group", { name: "View mode" })
      .getByRole("button", { name: "Day route" })
      .click();
  }
  if (test.info().project.name === "mobile-chromium") {
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Route preferences" })).toBeVisible();
  }
  const search = page.getByRole("searchbox", { name: "Search Carleton buildings" });
  await expect(search).toBeVisible();
  await search.fill("Tory Building");
  await expect(page.getByTestId("building-search-result").first()).toContainText("Tory Building");
  failures.assertClean();
});

test("UofT local default remains University of Toronto", async ({ page, baseURL }) => {
  test.skip(test.info().project.name !== "chromium");
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const failures = watchForAppFailures(page, baseURL);
  await page.goto("/");
  await expect(page).toHaveTitle("Gapwise — University of Toronto");
  await expect(page.getByRole("button", { name: "Import ACORN" })).toBeVisible();
  failures.assertClean();
});

test("Carleton calendar import feeds timetable, gaps, and Day Route on a tablet", async ({
  page,
  baseURL,
}) => {
  test.skip(test.info().project.name !== "chromium");
  if (!baseURL) throw new Error("Playwright baseURL is required");
  await page.setViewportSize({ width: 820, height: 1180 });
  const failures = watchForAppFailures(page, baseURL);
  await page.goto("/?university=carleton");
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:comp-1405",
    "SUMMARY:COMP 1405 A LEC - Intro to Computer Science",
    "LOCATION:TB 208",
    "DTSTART:20260909T100500",
    "DTEND:20260909T112500",
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261209T235959",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:busi-1004",
    "SUMMARY:BUSI 1004 A LEC - Financial Accounting",
    "LOCATION:DT 2203",
    "DTSTART:20260909T143500",
    "DTEND:20260909T155500",
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261209T235959",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  await page.locator("#ics-file").setInputFiles({
    name: "carleton.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(calendar),
  });
  await expect(page.getByText("COMP 1405").first()).toBeVisible();
  await expect(page.getByText("BUSI 1004").first()).toBeVisible();
  const views = page.getByRole("group", { name: "View mode" });
  await views.getByRole("button", { name: "Gap plan" }).click();
  await expect(page).toHaveURL(/\/gaps/);
  await expect(page.getByRole("heading", { name: "Gap plan" })).toBeVisible();
  await expect(page.getByText("Campus walking route.").first()).toBeVisible();
  await views.getByRole("button", { name: "Day route" }).click();
  await page
    .getByRole("group", { name: "Route weekday" })
    .getByRole("button", { name: "Monday" })
    .click();
  await expect(page.getByRole("searchbox", { name: "Search Carleton buildings" })).toBeVisible();
  await expect(page.locator(".map-time-marker")).toHaveCount(2);

  // Test Carleton Today view
  await views.getByRole("button", { name: "Today" }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.locator(".brand-scope-pill").first()).toHaveText("Carleton");

  failures.assertClean();
});

test("Unknown university edition displays safe unavailable fallback", async ({ page, baseURL }) => {
  test.skip(!["chromium", "mobile-chromium"].includes(test.info().project.name));
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const failures = watchForAppFailures(page, baseURL);

  await page.goto("/?university=unknown-institution");
  await expect(page.getByRole("heading", { name: "University edition unavailable" })).toBeVisible();
  await expect(page.getByText("This hostname is not registered with Gapwise.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Gapwise" })).toHaveAttribute(
    "href",
    "https://gapwise.ca",
  );
  failures.assertClean();
});

test("Direct URL refresh preserves university context in local development", async ({
  page,
  baseURL,
}) => {
  test.skip(test.info().project.name !== "chromium");
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const failures = watchForAppFailures(page, baseURL);

  await page.goto("/?university=carleton");
  await expect(page.getByText("For Carleton University", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import Carleton" })).toBeVisible();

  // Refresh page
  await page.reload();
  await expect(page.getByText("For Carleton University", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import Carleton" })).toBeVisible();
  failures.assertClean();
});

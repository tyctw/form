// Start Vite with the fake admin-test.supabase.co URL. All external requests mocked.
const { chromium } = require(process.argv[2] || "playwright");
const assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:4175/form/";
async function main() {
  const browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  try {
    for (const timezoneId of ["UTC", "Asia/Taipei", "America/Los_Angeles"]) {
      const context = await browser.newContext({
        timezoneId,
        viewport: { width: 390, height: 844 },
      });
      let cfg = {
        id: 1,
        system_enabled: true,
        subject_score_enabled: false,
        announcement_date: "2099-01-01T00:00:00Z",
        announcement_content: { title: "公告：115年度序位區間已開放查詢" },
        custom_questions: [
          {
            id: "q",
            type: "text",
            question: "台北時間題目",
            required: false,
            startTime: "2026-11-03T09:00:00Z",
            endTime: "2026-11-03T10:30:00-07:00",
          },
        ],
      };
      await context.route("https://**/*", (r) =>
        r
          .request()
          .url()
          .includes("admin-test.supabase.co/rest/v1/survey_config")
          ? r.fulfill({
              contentType: "application/json",
              body: JSON.stringify([cfg]),
            })
          : r.abort(),
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.setDefaultTimeout(10000);
      await page.clock.install({ time: new Date("2026-11-03T02:00:00Z") });
      await page.clock.pauseAt(new Date("2026-11-03T02:00:00Z"));
      await page.goto(base + "#/");
      await page
        .getByRole("heading", { name: "第 1/3 步：基本資料" })
        .waitFor();
      const banner = page.getByLabel("所選年度公告");
      assert.ok((await banner.innerText()).includes("116 年度序位尚未開放"));
      await page
        .getByLabel("會考年度（必填）", { exact: true })
        .selectOption("115");
      assert.ok((await banner.innerText()).includes("115 年度資料填寫"));
      await page
        .getByLabel("會考年度（必填）", { exact: true })
        .selectOption("116");
      await page
        .getByLabel("招生區（必填）", { exact: true })
        .selectOption("基北區");
      await page.getByRole("button", { name: "學生", exact: true }).click();
      await page
        .getByLabel("Email（必填）", { exact: true })
        .fill("test@example.invalid");
      await page.getByRole("button", { name: "下一步", exact: true }).click();
      await page
        .getByRole("heading", { name: "第 2/3 步：補充題目" })
        .waitFor();
      await page.getByLabel("台北時間題目", { exact: true }).waitFor();
      cfg = { ...cfg, announcement_date: "2026-01-01T00:00:00Z" };
      await page.reload();
      await page
        .getByRole("heading", { name: "第 1/4 步：基本資料" })
        .waitFor();
      assert.ok(
        (await banner.innerText()).includes("116 年度序位區間已開放填寫"),
      );
      assert.equal((await banner.innerText()).includes("115"), false);
      assert.ok((await page.title()).includes("116 年度"));
      assert.equal(
        (await page.locator("header").innerText()).includes("115"),
        false,
      );
      cfg = {
        ...cfg,
        announcement_content: {
          title: "自訂 {examYear} 年度",
          body: "公告時間 {announcementTime}",
          linkLabel: "查詢 {examYear}",
          linkUrl: "https://example.invalid",
        },
      };
      await page.reload();
      await page.getByText("自訂 116 年度", { exact: true }).waitFor();
      assert.ok((await banner.innerText()).includes("2026/01/01"));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        "PASS: selected-year announcements, legacy defaults, templates and Taipei question windows in " +
          timezoneId,
      );
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

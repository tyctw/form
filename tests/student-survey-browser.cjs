// Vite: VITE_SUPABASE_URL=https://admin-test.supabase.co VITE_SUPABASE_ANON_KEY=test-public-key
// All external requests are intercepted; no production data is read or written.
const { chromium } = require(process.argv[2] || "playwright");
const assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://127.0.0.1:4175/form/";
const NOW = "2026-11-03T02:00:00Z";
const defaultConfig = {
  id: 1,
  system_enabled: true,
  subject_score_enabled: true,
  announcement_date: "2026-06-16T04:00:00Z",
  custom_questions: [
    {
      id: "required",
      type: "text",
      question: "學校意見",
      required: true,
      startTime: "2026-11-03T09:00",
      endTime: "2026-11-03T12:00",
    },
  ],
};
async function main() {
  const browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const contexts = [];
  async function scenario(
    config = defaultConfig,
    viewport = { width: 390, height: 844 },
    blockedStorage = false,
  ) {
    const context = await browser.newContext({
      viewport,
      timezoneId: "America/Los_Angeles",
    });
    contexts.push(context);
    const calls = [],
      errors = [];
    let fail = false;
    await context.route("https://**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "admin-test.supabase.co") return route.abort();
      const json = (value, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (url.pathname === "/rest/v1/survey_config") return json([config]);
      if (url.pathname === "/rest/v1/rpc/submit_survey") {
        const body = route.request().postDataJSON();
        calls.push(body);
        return fail
          ? json({ message: "fixture unavailable" }, 503)
          : json({
              inviteCode: "SH2026110310",
              expiration: "2026-11-03T02:01:00Z",
            });
      }
      throw Error("Unexpected external endpoint " + url.pathname);
    });
    if (blockedStorage)
      await context.addInitScript(() => {
        for (const key of ["sessionStorage", "localStorage"])
          Object.defineProperty(window, key, {
            get() {
              throw new DOMException("blocked", "SecurityError");
            },
          });
      });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.install({ time: new Date(NOW) });
    await page.clock.pauseAt(new Date(NOW));
    await page.goto(base + "#/");
    await page.getByRole("heading", { name: /第 1\/.*步：基本資料/ }).waitFor();
    return {
      page,
      context,
      calls,
      errors,
      setFail: (value) => {
        fail = value;
      },
    };
  }
  const next = (p) =>
    p.getByRole("button", { name: "下一步", exact: true }).click();
  async function basic(page) {
    await page
      .getByLabel("招生區（必填）", { exact: true })
      .selectOption("基北區");
    await page.getByRole("button", { name: "學生", exact: true }).click();
    await page
      .getByLabel("Email（必填）", { exact: true })
      .fill("student@example.invalid");
    await next(page);
  }
  async function grades(page) {
    for (const label of ["國文", "數學", "英文", "社會", "自然"])
      await page
        .getByRole("button", { name: label + " A", exact: true })
        .click();
    await page.getByRole("button", { name: "作文 0", exact: true }).click();
  }
  try {
    const s = await scenario(),
      { page } = s;
    await next(page);
    assert.equal(
      await page
        .getByLabel("招生區（必填）", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page
      .getByLabel("招生區（必填）", { exact: true })
      .selectOption("基北區");
    await page.getByRole("button", { name: "學生", exact: true }).click();
    await page.getByLabel("Email（必填）", { exact: true }).fill("bad@");
    await next(page);
    assert.equal(
      await page
        .getByLabel("Email（必填）", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page
      .getByLabel("Email（必填）", { exact: true })
      .fill("student@example.invalid");
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("survey.student.remembered.v1"),
      ),
      null,
    );
    await page.reload();
    await page
      .getByText("已恢復本分頁尚未送出的草稿。", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Email（必填）", { exact: true }).inputValue(),
      "student@example.invalid",
    );
    await next(page);
    await grades(page);
    await page.getByLabel("序位填寫範例").waitFor();
    await page.getByLabel("最小比率（%）（必填）", { exact: true }).fill("101");
    await page
      .getByText("比率須為 0–100 之間的數字", { exact: true })
      .waitFor();
    await page.getByLabel("最小比率（%）（必填）", { exact: true }).fill("0");
    await page
      .getByLabel("最大比率（%）（必填）", { exact: true })
      .fill("2.50");
    await page
      .getByLabel("最小序位（名）（必填）", { exact: true })
      .fill("1.5");
    await page
      .getByLabel("最大序位（名）（必填）", { exact: true })
      .fill("100");
    await next(page);
    assert.equal(
      await page
        .getByLabel("最小序位（名）（必填）", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByLabel("最小序位（名）（必填）", { exact: true }).fill("1");
    await page.screenshot({
      path: "/tmp/student-scores-mobile.png",
      fullPage: true,
    });
    await next(page);
    await page.getByRole("heading", { name: "第 3/4 步：補充題目" }).waitFor(); // Taipei custom schedule, browser in Los Angeles.
    await next(page);
    await page.getByText("此題為必填", { exact: true }).last().waitFor();
    await page.getByLabel("學校意見", { exact: true }).fill("測試回答");
    await next(page);
    await page.getByRole("heading", { name: "第 4/4 步：確認送出" }).waitFor();
    await page
      .getByRole("button", { name: "修改基本資料", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Email（必填）", { exact: true }).inputValue(),
      "student@example.invalid",
    );
    await next(page);
    await next(page);
    await next(page);
    assert.ok((await page.locator("form").innerText()).includes("測試回答"));
    s.setFail(true);
    await page.getByRole("button", { name: "確認送出", exact: true }).click();
    await page
      .getByText("資料儲存失敗，請稍後再試或聯絡管理員。", { exact: true })
      .waitFor();
    const firstRequest = s.calls[0];
    await page.reload();
    await page
      .getByText("已恢復本分頁尚未送出的草稿。", { exact: true })
      .waitFor();
    await next(page);
    await next(page);
    await next(page);
    s.setFail(false);
    await page.getByRole("button", { name: "確認送出", exact: true }).click();
    await page
      .getByRole("heading", { name: "落點分析邀請碼", exact: true })
      .waitFor();
    assert.equal(s.calls[1].p_request_id, firstRequest.p_request_id);
    assert.equal(s.calls[1].p_payload.minRatio, "0");
    assert.equal(s.calls[1].p_payload.essayScore, "0");
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem("survey.student.session.v1"),
      ),
      null,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "落點分析邀請碼", exact: true })
      .waitFor();
    await page.clock.runFor(61000);
    await page
      .getByRole("heading", { name: "邀請碼已到期", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: "前往分析", exact: true }).count(),
      0,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "邀請碼已到期", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "重新填寫", exact: true }).click();
    await page.getByRole("heading", { name: /步：基本資料/ }).waitFor();
    assert.equal(
      await page.getByLabel("Email（必填）", { exact: true }).inputValue(),
      "",
    );
    assert.deepEqual(s.errors, []);
    // Remembered draft across tabs is opt-in, requires restoration and can be removed.
    const d = await scenario();
    await d.page
      .getByLabel("Email（必填）", { exact: true })
      .fill("remember@example.invalid");
    await d.page.getByRole("checkbox", { name: /記住這次填寫/ }).check();
    const remembered = await d.page.evaluate(() =>
      JSON.parse(localStorage.getItem("survey.student.remembered.v1")),
    );
    assert.equal(remembered.data.email, "remember@example.invalid");
    assert.equal(remembered.expiresAt - remembered.savedAt, 7 * 86400000);
    // Simulate a new visit with no current-tab draft, retaining only explicitly remembered data.
    await d.page.evaluate(() => sessionStorage.clear());
    await d.page.reload();
    await d.page.getByRole("button", { name: "恢復上次草稿" }).waitFor();
    assert.equal(
      await d.page.getByLabel("Email（必填）", { exact: true }).inputValue(),
      "",
    );
    await d.page.getByRole("button", { name: "恢復上次草稿" }).click();
    assert.equal(
      await d.page.getByLabel("Email（必填）", { exact: true }).inputValue(),
      "remember@example.invalid",
    );
    await d.page.getByRole("checkbox", { name: /記住這次填寫/ }).uncheck();
    assert.equal(
      await d.page.evaluate(() =>
        localStorage.getItem("survey.student.remembered.v1"),
      ),
      null,
    );
    const accept = d.page
      .waitForEvent("dialog")
      .then((dialog) => dialog.accept());
    await d.page.getByRole("button", { name: "清除草稿與填寫內容" }).click();
    await accept;
    assert.equal(
      await d.page.getByLabel("Email（必填）", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await d.page.evaluate(() =>
        sessionStorage.getItem("survey.student.session.v1"),
      ),
      null,
    );
    assert.deepEqual(d.errors, []);
    const skipped = await scenario(
      {
        ...defaultConfig,
        subject_score_enabled: false,
        announcement_date: "2099-01-01T00:00:00Z",
        custom_questions: [],
      },
      { width: 1440, height: 1000 },
    );
    await basic(skipped.page);
    await skipped.page
      .getByRole("heading", { name: "第 2/2 步：確認送出" })
      .waitFor();
    assert.ok(
      (await skipped.page.locator("form").innerText()).includes("未開放"),
    );
    await skipped.page.screenshot({
      path: "/tmp/student-review-desktop.png",
      fullPage: true,
    });
    await skipped.page
      .getByRole("button", { name: "確認送出", exact: true })
      .click();
    await skipped.page
      .getByRole("heading", { name: "落點分析邀請碼", exact: true })
      .waitFor();
    assert.equal(skipped.calls[0].p_payload.skipRanking, true);
    assert.equal(skipped.calls[0].p_payload.chineseScore, "");
    assert.equal("minRatio" in skipped.calls[0].p_payload, false);
    assert.deepEqual(skipped.errors, []);
    const blocked = await scenario(
      {
        ...defaultConfig,
        subject_score_enabled: false,
        announcement_date: "2099-01-01T00:00:00Z",
        custom_questions: [],
      },
      { width: 390, height: 844 },
      true,
    );
    await blocked.page
      .getByLabel("Email（必填）", { exact: true })
      .fill("safe@example.invalid");
    await blocked.page
      .getByText(
        "此瀏覽器無法保存草稿，關閉或重新整理後可能無法恢復。請先完成送出。",
        { exact: true },
      )
      .waitFor();
    assert.deepEqual(blocked.errors, []);
    assert.equal(
      await blocked.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await basic(blocked.page);
    await blocked.page
      .getByRole("button", { name: "確認送出", exact: true })
      .click();
    await blocked.page
      .getByRole("heading", { name: "落點分析邀請碼", exact: true })
      .waitFor();
    await blocked.page
      .getByText(
        "填答已送出，但無法在本分頁保存結果；離開前請先複製分析連結。",
        { exact: true },
      )
      .waitFor();
    assert.deepEqual(blocked.errors, []);
    const changing = await scenario({
      ...defaultConfig,
      custom_questions: [
        {
          ...defaultConfig.custom_questions[0],
          endTime: "2026-11-03T10:00:30",
        },
      ],
    });
    await basic(changing.page);
    await grades(changing.page);
    await changing.page
      .getByRole("checkbox", { name: "尚未取得／不提供序位", exact: true })
      .check();
    await next(changing.page);
    await changing.page
      .getByLabel("學校意見", { exact: true })
      .fill("已過期題目的舊答案");
    await next(changing.page);
    await changing.page.clock.runFor(31000);
    await changing.page
      .getByText("目前沒有開放的補充題目，本次不提交此區答案。", {
        exact: true,
      })
      .waitFor();
    await changing.page
      .getByRole("button", { name: "確認送出", exact: true })
      .click();
    await changing.page
      .getByRole("heading", { name: "落點分析邀請碼", exact: true })
      .waitFor();
    assert.deepEqual(changing.calls[0].p_payload.custom_answers, {});
    assert.deepEqual(changing.errors, []);
    const schedule = await scenario({
      ...defaultConfig,
      subject_score_end_time: "2026-11-03T02:00:10Z",
      announcement_date: "2099-01-01T00:00:00Z",
      custom_questions: [],
    });
    await basic(schedule.page);
    await grades(schedule.page);
    await next(schedule.page);
    await schedule.page.clock.runFor(11000);
    await schedule.page
      .getByRole("heading", { name: "第 2/2 步：確認送出" })
      .waitFor();
    await schedule.page
      .getByRole("button", { name: "確認送出", exact: true })
      .click();
    await schedule.page
      .getByRole("heading", { name: "落點分析邀請碼", exact: true })
      .waitFor();
    assert.equal(schedule.calls[0].p_payload.chineseScore, "");
    assert.deepEqual(schedule.errors, []);
    console.log(
      "PASS: mobile/desktop wizard; inline validation/focus; zero values; Taipei custom schedules; conditional steps; section editing; same-tab and opt-in persistence; clear/blocked storage; retry ID survives reload; success/expired receipts and disabled old links.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

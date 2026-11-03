import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getExamYears,
  normalizeQuestionTime,
  taipeiQuestionTime,
  isQuestionActive,
  formatTaipeiTime,
  DEFAULT_ANNOUNCEMENT,
  announcementForYear,
} from "../src/utils/surveyTime.ts";
import { parseSurveyConfig } from "../src/utils/surveyConfig.ts";
test("exam-year rollover uses July 15 in Taipei, independently of workstation timezone", () => {
  assert.equal(getExamYears(new Date("2026-07-14T15:59:59Z"))[0], "115");
  assert.equal(getExamYears(new Date("2026-07-14T16:00:00Z"))[0], "116");
  assert.deepEqual(getExamYears(new Date("2026-11-03T02:00:00Z")), [
    "116",
    "115",
    "114",
    "113",
    "112",
    "111",
  ]);
});
test("announcements use selected year and actual configured date; historical years are unrestricted", () => {
  const now = Date.parse("2026-11-03T02:00:00Z");
  const before = announcementForYear(
    DEFAULT_ANNOUNCEMENT,
    "116",
    "116",
    "2026-11-03T03:00:00Z",
    now,
  );
  assert.equal(before.before, true);
  assert.match(before.title, /116/);
  assert.match(before.body, /2026\/11\/03/);
  const history = announcementForYear(
    DEFAULT_ANNOUNCEMENT,
    "115",
    "116",
    "2099-01-01T00:00:00Z",
    now,
  );
  assert.equal(history.before, false);
  assert.equal(history.title, "115 年度資料填寫");
  assert.equal(history.linkUrl, "");
  const legacy = announcementForYear(
    { ...DEFAULT_ANNOUNCEMENT, title: "公告：115年度序位區間已開放查詢" },
    "116",
    "116",
    "2026-01-01T00:00:00Z",
    now,
  );
  assert.match(legacy.title, /116/);
  assert.equal(legacy.title.includes("115"), false);
  const custom = announcementForYear(
    {
      ...DEFAULT_ANNOUNCEMENT,
      title: "自訂 {examYear}",
      body: "時間 {announcementTime}",
      linkLabel: "查看 {examYear}",
      linkUrl: "https://example.invalid/?year=115",
    },
    "116",
    "116",
    "2026-01-01T00:00:00Z",
    now,
  );
  assert.equal(custom.title, "自訂 116");
  assert.equal(custom.linkLabel, "查看 116");
  assert.match(custom.body, /2026/);
  assert.equal(custom.linkUrl, "https://example.invalid/?year=115");
  assert.equal(
    announcementForYear(
      { ...DEFAULT_ANNOUNCEMENT, title: "115 年歷史資料說明" },
      "116",
      "116",
      null,
      now,
    ).title,
    "115 年歷史資料說明",
  );
  assert.equal(
    announcementForYear(DEFAULT_ANNOUNCEMENT, "116", "116", null, now).before,
    false,
  );
});
test("question wall times, inclusive boundaries and preview formatting are consistent across timezones", () => {
  const original = process.env.TZ;
  try {
    for (const zone of [
      "UTC",
      "Asia/Taipei",
      "America/Los_Angeles",
      "Europe/Berlin",
    ]) {
      process.env.TZ = zone;
      for (const raw of [
        "2026-11-03T10:00",
        "2026-11-03T10:00:00Z",
        "2026-11-03T10:00:00-07:00",
      ]) {
        assert.equal(
          taipeiQuestionTime(raw),
          Date.parse("2026-11-03T02:00:00Z"),
        );
        const normalized = normalizeQuestionTime(raw);
        assert.equal(/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized), false);
        assert.match(formatTaipeiTime(normalized), /10:00/);
      }
      const q = { startTime: "2026-11-03T10:00", endTime: "2026-11-03T10:30" };
      assert.equal(
        isQuestionActive(q, Date.parse("2026-11-03T01:59:59.999Z")),
        false,
      );
      assert.equal(
        isQuestionActive(q, Date.parse("2026-11-03T02:00:00Z")),
        true,
      );
      assert.equal(
        isQuestionActive(q, Date.parse("2026-11-03T02:30:00Z")),
        true,
      );
      assert.equal(
        isQuestionActive(q, Date.parse("2026-11-03T02:30:00.001Z")),
        false,
      );
      assert.equal(isQuestionActive({ startTime: "bad" }, Date.now()), false);
      assert.throws(() => normalizeQuestionTime("2026-02-30T10:00"));
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
test("configuration normalization preserves backend wall-clock semantics without mutating raw data", () => {
  const raw = {
    custom_questions: [
      {
        id: "q",
        type: "text",
        question: "題目",
        startTime: "2026-11-03T10:00:00Z",
        endTime: "2026-11-03T11:00:00-07:00",
      },
    ],
  };
  const parsed = parseSurveyConfig(raw);
  assert.equal(parsed.custom_questions[0].startTime, "2026-11-03T10:00:00");
  assert.equal(parsed.custom_questions[0].endTime, "2026-11-03T11:00:00");
  assert.equal(raw.custom_questions[0].startTime, "2026-11-03T10:00:00Z");
});

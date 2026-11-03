import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeSurveySteps,
  validateStudentSurvey,
  taipeiQuestionTime,
  decodeStudentDraft,
  decodeResult,
  DRAFT_TTL,
  readDraft,
  writeDraft,
} from "../src/utils/studentSurvey.ts";
const initial = {
  region: "",
  examYear: "116",
  identity: "",
  email: "",
  chineseScore: "",
  mathScore: "",
  englishScore: "",
  socialScore: "",
  scienceScore: "",
  essayScore: "",
  minRatio: "",
  maxRatio: "",
  minRankInterval: "",
  maxRankInterval: "",
  skipRanking: false,
  customAnswers: {},
};
const valid = {
  ...initial,
  region: "基北區",
  identity: "學生",
  email: "name@example.invalid",
  chineseScore: "A",
  mathScore: "A",
  englishScore: "A",
  socialScore: "A",
  scienceScore: "A",
  essayScore: "0",
  minRatio: "0",
  maxRatio: "100",
  minRankInterval: "1",
  maxRankInterval: "2147483647",
};
const rules = {
  years: ["116", "115"],
  scoresActive: true,
  forceSkipRanking: false,
  questions: [],
};
test("conditional steps skip unavailable score/rank and custom sections", () => {
  assert.deepEqual(activeSurveySteps(rules), ["basic", "scores", "review"]);
  assert.deepEqual(
    activeSurveySteps({
      ...rules,
      scoresActive: false,
      forceSkipRanking: true,
    }),
    ["basic", "review"],
  );
  assert.deepEqual(activeSurveySteps({ ...rules, questions: [{ id: "q" }] }), [
    "basic",
    "scores",
    "custom",
    "review",
  ]);
});
test("validation matches server numeric/grade boundaries and inactive sections", () => {
  assert.deepEqual(validateStudentSurvey(valid, rules), {});
  const bad = validateStudentSurvey(
    {
      ...valid,
      email: "bad@",
      minRatio: "101",
      maxRatio: "-1",
      minRankInterval: "1.5",
      maxRankInterval: "2147483648",
    },
    rules,
  );
  for (const key of [
    "email",
    "minRatio",
    "maxRatio",
    "minRankInterval",
    "maxRankInterval",
  ])
    assert.ok(bad[key]);
  for (const key of ["minRatio", "maxRatio"])
    assert.ok(
      validateStudentSurvey({ ...valid, minRatio: "4", maxRatio: "3" }, rules)[
        key
      ],
    );
  assert.ok(
    validateStudentSurvey(
      { ...valid, minRankInterval: "2", maxRankInterval: "1" },
      rules,
    ).maxRankInterval,
  );
  assert.ok(
    validateStudentSurvey({ ...valid, chineseScore: "A+++" }, rules)
      .chineseScore,
  );
  assert.deepEqual(
    validateStudentSurvey(
      { ...valid, chineseScore: "", minRatio: "bad" },
      { ...rules, scoresActive: false, forceSkipRanking: true },
    ),
    {},
  );
  assert.deepEqual(
    validateStudentSurvey(
      { ...valid, skipRanking: true, minRatio: "bad" },
      rules,
    ),
    {},
  );
});
test("custom answers are revalidated against current question definitions", () => {
  const questions = [
    { id: "t", type: "text", question: "字", required: true },
    {
      id: "c",
      type: "checkbox",
      question: "選",
      required: true,
      options: ["甲", "乙"],
    },
  ];
  let e = validateStudentSurvey(
    { ...valid, customAnswers: { t: " ", c: ["甲", "甲"] } },
    { ...rules, questions },
  );
  assert.ok(e["q:t"]);
  assert.ok(e["q:c"]);
  e = validateStudentSurvey(
    { ...valid, customAnswers: { t: "答", c: ["甲"] } },
    { ...rules, questions },
  );
  assert.deepEqual(e, {});
  e = validateStudentSurvey(
    { ...valid, customAnswers: { t: "x".repeat(2001), c: ["已移除"] } },
    { ...rules, questions },
  );
  assert.ok(e["q:t"]);
  assert.ok(e["q:c"]);
});
test("Taipei datetime-local schedules do not depend on browser timezone", () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(
      taipeiQuestionTime("2026-11-03T12:00"),
      Date.parse("2026-11-03T04:00:00Z"),
    );
    assert.equal(
      taipeiQuestionTime("2026-11-03T04:00:00Z"),
      Date.parse("2026-11-02T20:00:00Z"),
    );
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("draft decoding enforces version, expiry, safe types and request-ID retention", () => {
  const now = Date.now(),
    record = {
      version: 1,
      savedAt: now,
      expiresAt: now + DRAFT_TTL,
      remember: true,
      data: valid,
      pending: { id: "00000000-0000-0000-0000-000000000001", payload: "{}" },
    };
  const decode = (r) => decodeStudentDraft(JSON.stringify(r), initial, now);
  assert.equal(decode(record).data.email, valid.email);
  assert.equal(decode(record).pending.id, record.pending.id);
  assert.equal(decode({ ...record, version: 2 }), null);
  assert.equal(decode({ ...record, expiresAt: now - 1 }), null);
  assert.equal(decode({ ...record, expiresAt: now + DRAFT_TTL + 1 }), null);
  assert.equal(
    decode({ ...record, data: { ...valid, customAnswers: [] } }),
    null,
  );
  assert.equal(
    decode({
      ...record,
      data: { ...valid, customAnswers: JSON.parse('{"__proto__":"bad"}') },
    }),
    null,
  );
  assert.equal(decodeStudentDraft("broken json", initial, now), null);
});
test("blocked storage is tolerated; expired records removed and expired receipts remain visible for 24 hours", () => {
  const throwing = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("quota");
    },
    removeItem() {
      throw Error("denied");
    },
  };
  assert.equal(readDraft(throwing, "key", initial), null);
  assert.equal(writeDraft(throwing, "key", {}), false);
  let removed = false;
  const expired = {
    getItem: () => JSON.stringify({ version: 1, savedAt: 0, expiresAt: 1 }),
    removeItem: () => {
      removed = true;
    },
  };
  assert.equal(readDraft(expired, "key", initial), null);
  assert.equal(removed, true);
  const now = Date.now(),
    receipt = {
      code: "SH2026110312",
      expiration: new Date(now - 1000).toISOString(),
      savedAt: now - 2000,
    };
  assert.ok(decodeResult(JSON.stringify(receipt), now));
  assert.equal(
    decodeResult(
      JSON.stringify({ ...receipt, savedAt: now - 25 * 3600000 }),
      now,
    ),
    null,
  );
});

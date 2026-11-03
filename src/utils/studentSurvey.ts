import type { CustomQuestion, QuestionnaireData } from "../types";
export const STUDENT_REGIONS = [
  "基北區",
  "桃聯區",
  "竹苗區",
  "中投區",
  "彰化區",
  "雲林區",
  "嘉義區",
  "台南區",
  "高雄區",
  "屏東區",
  "宜蘭區",
  "花蓮區",
  "台東區",
  "澎湖區",
  "金門區",
];
export const STUDENT_IDENTITIES = ["學生", "家長", "老師", "補教業"];
export const SUBJECT_OPTIONS = ["A++", "A+", "A", "B++", "B+", "B", "C"];
export const SUBJECTS = [
  ["chineseScore", "國文"],
  ["mathScore", "數學"],
  ["englishScore", "英文"],
  ["socialScore", "社會"],
  ["scienceScore", "自然"],
  ["essayScore", "作文"],
] as const;
export type SurveyStep = "basic" | "scores" | "custom" | "review";
export type SurveyRules = {
  years: string[];
  scoresActive: boolean;
  forceSkipRanking: boolean;
  questions: CustomQuestion[];
};
export { taipeiQuestionTime } from './surveyTime.ts';
export function activeSurveySteps(rules: SurveyRules): SurveyStep[] {
  return [
    "basic",
    ...(rules.scoresActive || !rules.forceSkipRanking ? ["scores"] : []),
    ...(rules.questions.length ? ["custom"] : []),
    "review",
  ] as SurveyStep[];
}
export function fieldStep(field: string): SurveyStep {
  if (["region", "examYear", "identity", "email"].includes(field))
    return "basic";
  return field.startsWith("q:") ? "custom" : "scores";
}
export function validateStudentSurvey(
  data: QuestionnaireData,
  rules: SurveyRules,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!STUDENT_REGIONS.includes(data.region)) errors.region = "請選擇招生區";
  if (!rules.years.includes(data.examYear))
    errors.examYear = "請選擇可填寫的會考年度";
  if (!STUDENT_IDENTITIES.includes(data.identity))
    errors.identity = "請選擇填寫身分";
  if (!data.email.trim()) errors.email = "請填寫 Email";
  else if (
    data.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) ||
    /[\u0000-\u001f\u007f]/.test(data.email)
  )
    errors.email = "請輸入有效的 Email，例如 name@example.com";
  if (rules.scoresActive)
    for (const [key, label] of SUBJECTS) {
      if (
        !(
          key === "essayScore"
            ? ["0", "1", "2", "3", "4", "5", "6"]
            : SUBJECT_OPTIONS
        ).includes(data[key])
      )
        errors[key] = `請選擇${label}${key === "essayScore" ? "級分" : "成績"}`;
    }
  if (!data.skipRanking && !rules.forceSkipRanking) {
    for (const key of ["minRatio", "maxRatio"] as const) {
      if (!data[key].trim()) errors[key] = "請填寫比率（0–100）";
      else if (
        data[key].length > 12 ||
        !/^\d+(\.\d+)?$/.test(data[key]) ||
        Number(data[key]) > 100
      )
        errors[key] = "比率須為 0–100 之間的數字";
    }
    for (const key of ["minRankInterval", "maxRankInterval"] as const) {
      if (
        !/^\d+$/.test(data[key]) ||
        Number(data[key]) < 1 ||
        Number(data[key]) > 2147483647
      )
        errors[key] = "序位須為 1–2147483647 之間的整數";
    }
    if (
      !errors.minRatio &&
      !errors.maxRatio &&
      Number(data.minRatio) > Number(data.maxRatio)
    )
      errors.minRatio = errors.maxRatio = "最小比率不可大於最大比率";
    if (
      !errors.minRankInterval &&
      !errors.maxRankInterval &&
      Number(data.minRankInterval) > Number(data.maxRankInterval)
    )
      errors.minRankInterval = errors.maxRankInterval =
        "最小序位不可大於最大序位";
  }
  for (const q of rules.questions) {
    const answer = data.customAnswers[q.id],
      key = "q:" + q.id;
    const empty =
      answer == null ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0);
    if (empty) {
      if (q.required) errors[key] = "此題為必填";
      continue;
    }
    if (
      q.type === "text" &&
      (typeof answer !== "string" || !answer.trim() || answer.length > 2000)
    )
      errors[key] = "請輸入 1–2000 字的回答";
    if (
      q.type === "radio" &&
      (typeof answer !== "string" || !q.options?.includes(answer))
    )
      errors[key] = "請重新選擇有效選項";
    if (
      q.type === "checkbox" &&
      (!Array.isArray(answer) ||
        answer.length > 100 ||
        answer.some((x) => !q.options?.includes(x)) ||
        new Set(answer).size !== answer.length)
    )
      errors[key] = "請重新選擇有效選項，不可重複";
  }
  return errors;
}

export const SESSION_DRAFT_KEY = "survey.student.session.v1";
export const REMEMBERED_DRAFT_KEY = "survey.student.remembered.v1";
export const RESULT_KEY = "survey.student.result.v1";
export const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
export type PendingSubmission = { id: string; payload: string };
export type StudentDraft = {
  version: 1;
  savedAt: number;
  expiresAt: number;
  remember: boolean;
  data: QuestionnaireData;
  pending: PendingSubmission | null;
};
export function decodeStudentDraft(
  raw: string | null,
  initial: QuestionnaireData,
  now = Date.now(),
): StudentDraft | null {
  try {
    if (!raw || raw.length > 100000) return null;
    const record = JSON.parse(raw);
    if (
      record.version !== 1 ||
      !Number.isFinite(record.savedAt) ||
      record.savedAt > now + 60000 ||
      !Number.isFinite(record.expiresAt) ||
      record.expiresAt <= now ||
      record.expiresAt > record.savedAt + DRAFT_TTL ||
      typeof record.remember !== "boolean"
    )
      return null;
    const data = record.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const clean = { ...initial, customAnswers: {} } as QuestionnaireData;
    for (const key of Object.keys(initial) as (keyof QuestionnaireData)[]) {
      if (key === "customAnswers" || key === "skipRanking") continue;
      if (typeof data[key] !== "string" || data[key].length > 254) return null;
      (clean as any)[key] = data[key];
    }
    if (
      typeof data.skipRanking !== "boolean" ||
      !data.customAnswers ||
      typeof data.customAnswers !== "object" ||
      Array.isArray(data.customAnswers)
    )
      return null;
    if (JSON.stringify(data.customAnswers).length > 32768) return null;
    for (const [key, value] of Object.entries(data.customAnswers)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) return null;
      if (typeof value === "string" && value.length <= 2000)
        clean.customAnswers[key] = value;
      else if (
        Array.isArray(value) &&
        value.length <= 100 &&
        value.every((x) => typeof x === "string" && x.length <= 2000)
      )
        clean.customAnswers[key] = value;
      else return null;
    }
    clean.skipRanking = data.skipRanking;
    const p = record.pending;
    const pending =
      p &&
      typeof p.id === "string" &&
      /^[a-f0-9-]{36}$/i.test(p.id) &&
      typeof p.payload === "string" &&
      p.payload.length <= 32768
        ? { id: p.id, payload: p.payload }
        : null;
    return { ...record, data: clean, pending };
  } catch {
    return null;
  }
}
export function readDraft(
  storage: Storage,
  key: string,
  initial: QuestionnaireData,
): StudentDraft | null {
  try {
    const raw = storage.getItem(key);
    const parsed = decodeStudentDraft(raw, initial);
    if (raw && !parsed) storage.removeItem(key);
    return parsed;
  } catch {
    return null;
  }
}
export function writeDraft(
  storage: Storage,
  key: string,
  record: StudentDraft,
): boolean {
  try {
    const raw = JSON.stringify(record);
    if (
      raw.length > 100000 ||
      !decodeStudentDraft(raw, record.data, record.savedAt)
    )
      return false;
    storage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
export function removeStored(storage: Storage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
export function hasDraftInput(
  data: QuestionnaireData,
  initial: QuestionnaireData,
) {
  return JSON.stringify(data) !== JSON.stringify(initial);
}
export function decodeResult(
  raw: string | null,
  now = Date.now(),
): { code: string; expiration: Date } | null {
  try {
    if (!raw || raw.length > 1000) return null;
    const r = JSON.parse(raw);
    const at = Date.parse(r.expiration);
    if (
      typeof r.code !== "string" ||
      !/^SH\d{10}$/.test(r.code) ||
      !Number.isFinite(at) ||
      !Number.isFinite(r.savedAt) ||
      now - r.savedAt > 24 * 60 * 60 * 1000 ||
      r.savedAt > now + 60000
    )
      return null;
    return { code: r.code, expiration: new Date(at) };
  } catch {
    return null;
  }
}

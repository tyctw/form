import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { QuestionnaireData } from "../types";
import {
  activeSurveySteps,
  fieldStep,
  validateStudentSurvey,
  STUDENT_REGIONS,
  STUDENT_IDENTITIES,
  SUBJECTS,
  SUBJECT_OPTIONS,
  type SurveyRules,
  type SurveyStep,
  type StudentDraft,
} from "../utils/studentSurvey";

type Props = {
  data: QuestionnaireData;
  setData: React.Dispatch<React.SetStateAction<QuestionnaireData>>;
  rules: SurveyRules;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string;
  remember: boolean;
  setRemember: (value: boolean) => void;
  recoveryMessage: string;
  storageError: string;
  persistentDraft: StudentDraft | null;
  restoreDraft: () => void;
  clearDraft: () => void;
};
const TITLES: Record<SurveyStep, string> = {
  basic: "基本資料",
  scores: "成績與序位",
  custom: "補充題目",
  review: "確認送出",
};
const ORDER: SurveyStep[] = ["basic", "scores", "custom", "review"];
const inputClass = "student-input min-h-12 scroll-mt-28";
export function StudentSurvey(p: Props) {
  const { data, setData, rules } = p;
  const steps = activeSurveySteps(rules);
  const [step, setStep] = useState<SurveyStep>("basic");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    field: string;
    nonce: number;
  } | null>(null);
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const actionBar = useRef<HTMLDivElement>(null);
  const formElement = useRef<HTMLFormElement>(null);
  const revealField = (target: HTMLElement | null) => {
    if (
      !target ||
      !target.matches(
        'input:not([type="checkbox"]):not([type="radio"]), select, textarea',
      )
    )
      return;
    requestAnimationFrame(() => {
      const box = target.getBoundingClientRect();
      const bottom =
        actionBar.current?.getBoundingClientRect().top ?? window.innerHeight;
      if (box.bottom > bottom - 12 || box.top < 80)
        target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };
  useEffect(() => {
    const reveal = () => {
      const target = document.activeElement as HTMLElement | null;
      if (target && formElement.current?.contains(target)) revealField(target);
    };
    window.visualViewport?.addEventListener("resize", reveal);
    return () => window.visualViewport?.removeEventListener("resize", reveal);
  }, []);
  const errors = validateStudentSurvey(data, rules);
  const skip = data.skipRanking || rules.forceSkipRanking;
  const current = steps.includes(step)
    ? step
    : steps.find((s) => ORDER.indexOf(s) > ORDER.indexOf(step)) || "review";
  const index = steps.indexOf(current);
  useEffect(() => {
    if (current !== step) setStep(current);
  }, [current, step]);
  useEffect(() => {
    heading.current?.focus();
  }, [current]);
  useEffect(() => {
    if (!focusRequest) return;
    const el = document.querySelector<HTMLElement>(
      `[data-survey-field="${CSS.escape(focusRequest.field)}"]`,
    );
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusRequest, current]);
  useEffect(() => {
    const original = document.title;
    document.title = `第 ${index + 1}/${steps.length} 步：${TITLES[current]}｜${data.examYear} 年度會考序位調查問卷`;
    return () => {
      document.title = original;
    };
  }, [current, index, steps.length, data.examYear]);
  const change = (key: keyof QuestionnaireData, value: any) =>
    setData((prev) => ({ ...prev, [key]: value }));
  const touch = (key: string) =>
    setTouched((prev) => ({ ...prev, [key]: true }));
  const visibleError = (key: string) =>
    errors[key] &&
    (touched[key] ||
      attempted ||
      (typeof (data as any)[key] === "string" && (data as any)[key] !== ""));
  const errorText = (key: string) => (
    <>
      {visibleError(key) && (
        <p
          id={`error-${key}`}
          className="mt-2 text-sm font-bold text-red-700"
          role="status"
        >
          {errors[key]}
        </p>
      )}
    </>
  );
  const fieldAttrs = (key: string) => ({
    "data-survey-field": key,
    "aria-invalid": !!visibleError(key),
    "aria-describedby": visibleError(key) ? `error-${key}` : undefined,
  });
  const go = (next: SurveyStep) => {
    setStep(next);
    setAttempted(false);
    setErrorSummary([]);
  };
  const focusError = (key: string) => {
    setStep(fieldStep(key));
    setTouched((prev) => ({ ...prev, [key]: true }));
    setFocusRequest({ field: key, nonce: Date.now() });
  };
  const advance = (event: React.FormEvent) => {
    event.preventDefault();
    if (p.submitting) return;
    const relevant = Object.keys(errors).filter(
      (key) => current === "review" || fieldStep(key) === current,
    );
    setAttempted(true);
    setErrorSummary(relevant);
    if (relevant.length) {
      focusError(relevant[0]);
      return;
    }
    if (current === "review") {
      p.onSubmit();
      return;
    }
    go(steps[index + 1]);
  };
  const answer = (id: string, value: any) =>
    setData((prev) => ({
      ...prev,
      customAnswers: { ...prev.customAnswers, [id]: value },
    }));
  const scoreGroup = (key: (typeof SUBJECTS)[number][0], label: string) => {
    const options =
      key === "essayScore"
        ? ["6", "5", "4", "3", "2", "1", "0"]
        : SUBJECT_OPTIONS;
    return (
      <fieldset
        key={key}
        tabIndex={-1}
        {...fieldAttrs(key)}
        className="student-score-group scroll-mt-28"
      >
        <legend className="mb-3 font-bold">
          {label}
          {key === "essayScore" ? "級分" : "成績"}{" "}
          <span className="text-red-700">（必填）</span>
        </legend>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {options.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={data[key] === value}
              aria-label={`${label} ${value}`}
              onClick={() => {
                change(key, value);
                touch(key);
              }}
              className="student-choice student-score-choice"
            >
              {value}
              {data[key] === value && (
                <span className="student-choice-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
        {errorText(key)}
      </fieldset>
    );
  };
  const reviewSection = (
    title: string,
    target: SurveyStep,
    content: React.ReactNode,
  ) => (
    <section className="student-review-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-black">{title}</h3>
        {steps.includes(target) && (
          <button
            type="button"
            onClick={() => go(target)}
            className="student-edit-button"
            aria-label={`修改${title}`}
          >
            修改
          </button>
        )}
      </div>
      {content}
    </section>
  );
  return (
    <div className="student-card" data-step={current}>
      <div className="student-card-header">
        <p className="student-eyebrow">{data.examYear} 年度 · 全國會考調查</p>
        <h1 className="student-title">會考序位調查問卷</h1>
        <p className="student-intro">
          依成績單填寫。沒有序位也可以繼續，送出前可再次確認。
        </p>
        <ol
          aria-label="填寫進度"
          className="student-stepper"
          style={{ "--step-count": steps.length } as React.CSSProperties}
        >
          {steps.map((key, i) => (
            <li
              key={key}
              aria-current={key === current ? "step" : undefined}
              className={`student-step ${i < index ? "is-complete" : ""}`}
            >
              <button
                type="button"
                disabled={i >= index || p.submitting}
                onClick={() => go(key)}
                className="student-step-button"
                aria-label={`返回${TITLES[key]}`}
              >
                <span className="student-step-number">
                  {i < index ? <Check size={15} aria-hidden="true" /> : i + 1}
                </span>
                <span className="student-step-label">
                  <span className="student-step-name">{TITLES[key]}</span>
                  <small>
                    {i === index
                      ? "目前填寫"
                      : i < index
                        ? "已填寫"
                        : "接續步驟"}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <progress
          className="student-progress sr-only"
          value={index + 1}
          max={steps.length}
          aria-label="填寫步驟進度"
        />
      </div>
      <div className="student-card-body">
        <p className="student-form-kicker" aria-hidden="true">
          填寫資料{" "}
          <span>
            {index + 1} / {steps.length}
          </span>
        </p>
        <h2
          ref={heading}
          tabIndex={-1}
          className="student-section-title scroll-mt-28"
        >
          第 {index + 1}/{steps.length} 步：{TITLES[current]}
        </h2>
        <p className="student-section-hint">
          {
            {
              basic: "先填寫基本資訊，後續步驟都可以返回修改。",
              scores: "依照成績單選擇等級，不確定序位時可以略過。",
              custom: "請依實際情況回答，標示選填的題目可以留白。",
              review: "再確認一次，讓每一份填答都更準確。",
            }[current]
          }
        </p>
        {p.recoveryMessage && (
          <p role="status" className="text-emerald-800">
            {p.recoveryMessage}
          </p>
        )}
        {errorSummary.filter((key) => errors[key]).length > 0 && (
          <div role="alert" className="student-error-summary">
            <p className="font-bold">請修正以下欄位：</p>
            <ul>
              {errorSummary
                .filter((key) => errors[key])
                .map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="min-h-11 text-red-800 underline text-left"
                      onClick={() => focusError(key)}
                    >
                      {errors[key]}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <form
          ref={formElement}
          onFocusCapture={(event) => revealField(event.target as HTMLElement)}
          onSubmit={advance}
          noValidate
        >
          <fieldset
            disabled={p.submitting}
            className={`student-fields min-w-0 ${current === "basic" ? "student-basic-grid" : ""}`}
          >
            {current === "basic" && (
              <>
                <div>
                  <label
                    className="block font-bold mb-2"
                    htmlFor="student-region"
                  >
                    招生區（必填）
                  </label>
                  <select
                    id="student-region"
                    {...fieldAttrs("region")}
                    className={inputClass}
                    value={data.region}
                    onBlur={() => touch("region")}
                    onChange={(event) => change("region", event.target.value)}
                  >
                    <option value="">請選擇招生區</option>
                    {STUDENT_REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  {errorText("region")}
                </div>
                <div>
                  <label
                    className="block font-bold mb-2"
                    htmlFor="student-year"
                  >
                    會考年度（必填）
                  </label>
                  <select
                    id="student-year"
                    {...fieldAttrs("examYear")}
                    className={inputClass}
                    value={data.examYear}
                    onChange={(event) => change("examYear", event.target.value)}
                  >
                    {!rules.years.includes(data.examYear) && (
                      <option value={data.examYear}>請重新選擇年度</option>
                    )}
                    {rules.years.map((y) => (
                      <option key={y} value={y}>
                        {y} 年度
                      </option>
                    ))}
                  </select>
                  {errorText("examYear")}
                </div>
                <fieldset
                  tabIndex={-1}
                  {...fieldAttrs("identity")}
                  className="student-identity scroll-mt-28"
                >
                  <legend className="font-bold mb-3">填寫身分（必填）</legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STUDENT_IDENTITIES.map((identity) => (
                      <button
                        key={identity}
                        type="button"
                        aria-pressed={data.identity === identity}
                        onClick={() => {
                          change("identity", identity);
                          touch("identity");
                        }}
                        className="student-choice"
                      >
                        {identity}
                        {data.identity === identity && " ✓"}
                      </button>
                    ))}
                  </div>
                  {errorText("identity")}
                </fieldset>
                <div>
                  <label
                    className="block font-bold mb-2"
                    htmlFor="student-email"
                  >
                    Email（必填）
                  </label>
                  <input
                    id="student-email"
                    {...fieldAttrs("email")}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    className={inputClass}
                    value={data.email}
                    onBlur={() => touch("email")}
                    onChange={(event) => change("email", event.target.value)}
                    placeholder="name@example.com"
                    maxLength={254}
                  />
                  {errorText("email")}
                  <p className="mt-2 text-xs text-slate-500">
                    用於資料聯繫與提交頻率限制；目前不會寄送驗證信。請勿填寫他人的信箱。
                  </p>
                </div>
              </>
            )}
            {current === "scores" && (
              <>
                {rules.scoresActive ? (
                  <div className="student-subjects">
                    {SUBJECTS.map(([key, label]) => scoreGroup(key, label))}
                  </div>
                ) : (
                  <p className="bg-slate-100 p-4 text-sm">
                    各科成績目前未開放，本次不會提交先前輸入的成績。
                  </p>
                )}
                <div className="student-skip-card">
                  <label className="flex items-start gap-3 font-bold">
                    <input
                      type="checkbox"
                      className="mt-1 w-5 h-5 shrink-0"
                      checked={skip}
                      disabled={rules.forceSkipRanking}
                      onChange={(event) =>
                        change("skipRanking", event.target.checked)
                      }
                    />
                    <span>尚未取得／不提供序位</span>
                  </label>
                  {rules.forceSkipRanking && (
                    <p className="mt-3 text-sm text-slate-600">
                      {data.examYear} 年度序位尚未開放，本次自動略過序位。
                    </p>
                  )}
                </div>
                {!skip && (
                  <>
                    <aside
                      className="student-example"
                      aria-label="序位填寫範例"
                    >
                      <h3 className="font-black mb-2">
                        照著成績單填，不必自行換算
                      </h3>
                      <p>
                        範例：比率「2.50%～3.00%」填入
                        2.50、3.00；序位「501～600 名」填入 501、600。
                      </p>
                      <p className="mt-2">
                        比率是百分比，序位是名次，兩者不能互換。範例僅說明格式，並非您的成績。
                      </p>
                    </aside>
                    <div className="grid sm:grid-cols-2 gap-5">
                      {(
                        [
                          ["minRatio", "最小比率（%）"],
                          ["maxRatio", "最大比率（%）"],
                          ["minRankInterval", "最小序位（名）"],
                          ["maxRankInterval", "最大序位（名）"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <label
                            className="block font-bold mb-2"
                            htmlFor={`student-${key}`}
                          >
                            {label}（必填）
                          </label>
                          <input
                            id={`student-${key}`}
                            {...fieldAttrs(key)}
                            className={inputClass}
                            type="text"
                            inputMode={
                              key.includes("Ratio") ? "decimal" : "numeric"
                            }
                            autoComplete="off"
                            maxLength={12}
                            value={data[key]}
                            onBlur={() => touch(key)}
                            onChange={(event) =>
                              change(key, event.target.value)
                            }
                          />
                          {errorText(key)}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {current === "custom" &&
              rules.questions.map((q) => (
                <fieldset
                  key={q.id}
                  tabIndex={-1}
                  {...fieldAttrs("q:" + q.id)}
                  className="student-question scroll-mt-28 min-w-0"
                >
                  <legend className="px-2 font-bold break-words">
                    {q.question}（{q.required ? "必填" : "選填"}）
                  </legend>
                  {q.type === "text" ? (
                    <>
                      <label className="sr-only" htmlFor={"answer-" + q.id}>
                        {q.question}
                      </label>
                      <textarea
                        id={"answer-" + q.id}
                        maxLength={2000}
                        value={data.customAnswers[q.id] || ""}
                        onBlur={() => touch("q:" + q.id)}
                        onChange={(event) => answer(q.id, event.target.value)}
                        className={inputClass}
                        rows={3}
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        最多 2000 字
                      </p>
                    </>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {q.options?.map((option) => (
                        <label
                          key={option}
                          className="student-answer-choice flex items-center gap-3 break-words"
                        >
                          <input
                            className="w-5 h-5 shrink-0"
                            type={q.type === "radio" ? "radio" : "checkbox"}
                            name={"answer-" + q.id}
                            checked={
                              q.type === "radio"
                                ? data.customAnswers[q.id] === option
                                : (Array.isArray(data.customAnswers[q.id])
                                    ? data.customAnswers[q.id]
                                    : []
                                  ).includes(option)
                            }
                            onChange={() => {
                              const old = Array.isArray(
                                data.customAnswers[q.id],
                              )
                                ? data.customAnswers[q.id]
                                : [];
                              answer(
                                q.id,
                                q.type === "radio"
                                  ? option
                                  : old.includes(option)
                                    ? old.filter((x: string) => x !== option)
                                    : [...old, option],
                              );
                              touch("q:" + q.id);
                            }}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  )}
                  {errorText("q:" + q.id)}
                </fieldset>
              ))}
            {current === "review" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  以下只顯示這次將提交的內容。按「修改」可返回該區，其他答案會保留。
                </p>
                {reviewSection(
                  "基本資料",
                  "basic",
                  <dl className="grid gap-2 text-sm">
                    <div>招生區：{data.region || "未填"}</div>
                    <div>年度：{data.examYear || "未填"}</div>
                    <div>身分：{data.identity || "未填"}</div>
                    <div className="break-all">
                      Email：{data.email.trim() || "未填"}
                    </div>
                  </dl>,
                )}
                {reviewSection(
                  "成績與序位",
                  "scores",
                  <div className="text-sm space-y-3">
                    {rules.scoresActive ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SUBJECTS.map(([key, label]) => (
                          <p key={key}>
                            {label}：{data[key] || "未填"}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p>各科成績：未開放，本次不提交。</p>
                    )}
                    {skip ? (
                      <p>
                        序位：
                        {rules.forceSkipRanking
                          ? "尚未開放，系統自動略過"
                          : "您選擇尚未取得／不提供，本次不提交"}
                        。
                      </p>
                    ) : (
                      <>
                        <p>
                          比率：{data.minRatio || "未填"}% ～{" "}
                          {data.maxRatio || "未填"}%
                        </p>
                        <p>
                          序位：{data.minRankInterval || "未填"} ～{" "}
                          {data.maxRankInterval || "未填"} 名
                        </p>
                      </>
                    )}
                  </div>,
                )}
                {reviewSection(
                  "補充題目",
                  "custom",
                  rules.questions.length ? (
                    <dl className="space-y-3 text-sm">
                      {rules.questions.map((q) => (
                        <div key={q.id}>
                          <dt className="font-bold break-words">
                            {q.question}
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words">
                            {Array.isArray(data.customAnswers[q.id])
                              ? data.customAnswers[q.id].join("、") ||
                                "未填（選填）"
                              : data.customAnswers[q.id] ||
                                `未填（${q.required ? "必填" : "選填"}）`}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm">
                      目前沒有開放的補充題目，本次不提交此區答案。
                    </p>
                  ),
                )}
                {p.submitError && (
                  <p
                    role="alert"
                    className="border-2 border-red-400 bg-red-50 p-4 text-red-800"
                  >
                    {p.submitError}
                  </p>
                )}
              </div>
            )}
          </fieldset>
          <details
            open={current === "basic"}
            className="student-draft"
            aria-label="草稿保存"
          >
            <summary>
              <span>草稿保存與清除</span>
              <span className="student-draft-meta">
                瀏覽器暫存 <ChevronDown size={15} aria-hidden="true" />
              </span>
            </summary>
            <p>
              本分頁會暫存草稿，方便意外重新整理後恢復；每份草稿在最後保存後 7
              天到期。
            </p>
            <label className="flex items-start gap-3">
              <input
                className="mt-1 w-5 h-5 shrink-0"
                type="checkbox"
                checked={p.remember}
                onChange={(event) => p.setRemember(event.target.checked)}
                disabled={p.submitting}
              />
              <span>
                記住這次填寫（此裝置最多 7 天）
                <span className="block text-xs text-slate-500 mt-1">
                  共用電腦請勿勾選；將保存
                  Email、成績及回答。送出成功後會清除草稿。
                </span>
              </span>
            </label>
            {p.persistentDraft && (
              <div className="border border-amber-400 p-3">
                <p>
                  此裝置有一份保存的草稿，期限至{" "}
                  {new Date(p.persistentDraft.expiresAt).toLocaleString(
                    "zh-TW",
                    {
                      timeZone: "Asia/Taipei",
                    },
                  )}
                  （台北時間）。
                </p>
                <button
                  type="button"
                  onClick={p.restoreDraft}
                  disabled={p.submitting}
                  className="min-h-11 mr-4 underline font-bold"
                >
                  恢復上次草稿
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm("確定清除草稿及已填寫內容？")) {
                  p.clearDraft();
                  go("basic");
                }
              }}
              disabled={p.submitting}
              className="student-clear-button"
            >
              清除草稿與填寫內容
            </button>
            {p.storageError && (
              <p role="alert" className="text-red-700">
                {p.storageError}
              </p>
            )}
          </details>
          {current !== "basic" && p.storageError && (
            <p role="alert" className="mb-4 text-red-700">
              {p.storageError}
            </p>
          )}
          <div
            className="student-actions"
            ref={actionBar}
            aria-label="步驟操作"
          >
            {index > 0 && (
              <button
                type="button"
                disabled={p.submitting}
                onClick={() => go(steps[index - 1])}
                className="student-secondary-button"
              >
                上一步
              </button>
            )}
            <button
              type="submit"
              disabled={p.submitting}
              className="student-primary-button"
            >
              {p.submitting
                ? "資料提交中…"
                : current === "review"
                  ? "確認送出"
                  : "下一步"}
              {!p.submitting &&
                (current === "review" ? (
                  <Check size={18} aria-hidden="true" />
                ) : (
                  <ArrowRight size={18} aria-hidden="true" />
                ))}
            </button>
          </div>
          <p className="student-form-note">
            確認送出前，資料不會提交至伺服器。
          </p>
        </form>
      </div>
    </div>
  );
}

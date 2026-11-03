import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { createSurveyPayload } from "../utils/surveySubmission";
import { parseSurveyConfig } from "../utils/surveyConfig";
import { useStudentDraft } from "../hooks/useStudentDraft";
import { StudentSurvey } from "../components/StudentSurvey";
import { StudentResult } from "../components/StudentResult";
import { validateStudentSurvey } from "../utils/studentSurvey";
import {
  getExamYears,
  DEFAULT_ANNOUNCEMENT,
  announcementForYear,
  isQuestionActive,
} from "../utils/surveyTime";
import { Header } from "../components/Header";
import {
  Atom,
  X,
  Share2,
  MessageCircle,
  Facebook,
  AtSign,
  Instagram,
  Copy,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CustomQuestion, QuestionnaireData } from "../types";

const initialData: QuestionnaireData = {
  region: "",
  examYear: getExamYears()[0],
  identity: "",
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
  email: "",
  skipRanking: false,
  customAnswers: {},
};

export default function Home() {
  const {
    formData,
    setFormData,
    pendingSubmission,
    remember,
    setRemember,
    persistentDraft,
    restoreRemembered,
    clearDraft,
    resetDraft,
    recoveryMessage,
    storageError,
    savePending,
    completeDraft,
    restoredResult,
  } = useStudentDraft(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(!!restoredResult);
  const [inviteResult, setInviteResult] = useState<{
    code: string;
    expiration: Date;
  } | null>(restoredResult);
  const [submitError, setSubmitError] = useState("");
  const [clockNow, setClockNow] = useState(Date.now());
  const examYears = getExamYears(new Date(clockNow));
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  // App Config Settings
  const [announcementDate, setAnnouncementDate] = useState<string | null>(null);
  const [announcementContent, setAnnouncementContent] =
    useState(DEFAULT_ANNOUNCEMENT);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [subjectScoreStartTime, setSubjectScoreStartTime] = useState<
    string | null
  >(null);
  const [subjectScoreEndTime, setSubjectScoreEndTime] = useState<string | null>(
    null,
  );
  const [subjectScoreEnabled, setSubjectScoreEnabled] = useState(true);
  const [systemStartTime, setSystemStartTime] = useState<string | null>(null);
  const [systemEndTime, setSystemEndTime] = useState<string | null>(null);
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [settingsError, setSettingsError] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (!supabase) throw new Error("提交服務尚未設定");
        const { data: rawData, error } = await supabase
          .from("survey_config")
          .select("*")
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error || !rawData) throw new Error("無法取得問卷設定");
        const data = parseSurveyConfig(rawData);
        if (data) {
          if (data.announcement_date)
            setAnnouncementDate(data.announcement_date);
          if (data.announcement_content)
            setAnnouncementContent({
              ...DEFAULT_ANNOUNCEMENT,
              ...data.announcement_content,
            });
          if (data.custom_questions) {
            setCustomQuestions(
              data.custom_questions.filter(
                (q: any) => q.id !== "__SYSTEM_BACKUPS__",
              ),
            );
          }
          if (data.subject_score_start_time)
            setSubjectScoreStartTime(data.subject_score_start_time);
          if (data.subject_score_end_time)
            setSubjectScoreEndTime(data.subject_score_end_time);
          setSubjectScoreEnabled(data.subject_score_enabled === true);
          if (data.system_start_time)
            setSystemStartTime(data.system_start_time);
          if (data.system_end_time) setSystemEndTime(data.system_end_time);
          setSystemEnabled(data.system_enabled === true);
        }
      } catch (e) {
        setSettingsError(true);
        console.error("無法載入問卷設定", e);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const announcement = announcementForYear(
    announcementContent,
    formData.examYear,
    examYears[0],
    announcementDate,
    clockNow,
  );
  const forceSkipRanking = announcement.before;
  const effectiveSkipRanking = formData.skipRanking || forceSkipRanking;

  const isSubjectScoreActive = (() => {
    if (!subjectScoreEnabled) return false;
    const now = new Date(clockNow);
    if (subjectScoreStartTime && now < new Date(subjectScoreStartTime))
      return false;
    if (subjectScoreEndTime && now > new Date(subjectScoreEndTime))
      return false;
    return true;
  })();

  const isSystemActive = (() => {
    if (!systemEnabled) return false;
    const now = new Date(clockNow);
    if (systemStartTime && now < new Date(systemStartTime)) return false;
    if (systemEndTime && now > new Date(systemEndTime)) return false;
    return true;
  })();

  const activeCustomQuestions = customQuestions.filter((q) =>
    isQuestionActive(q, clockNow),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => setSubmitError(""), [formData]);

  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    const validation = validateStudentSurvey(formData, {
      years: examYears,
      scoresActive: isSubjectScoreActive,
      forceSkipRanking,
      questions: activeCustomQuestions,
    });
    if (Object.keys(validation).length) {
      setSubmitError("表單開放狀態或必填內容已變更，請返回確認後再送出。");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    try {
      if (!supabase) {
        throw new Error("提交服務暫時無法使用，請稍後再試。");
      }

      const payload = createSurveyPayload(
        formData,
        effectiveSkipRanking,
        isSubjectScoreActive,
        activeCustomQuestions.map((question) => question.id),
      );
      const serialized = JSON.stringify(payload);
      if (
        !pendingSubmission.current ||
        pendingSubmission.current.payload !== serialized
      ) {
        savePending({ id: crypto.randomUUID(), payload: serialized });
      }
      const { data: result, error } = await supabase.rpc("submit_survey", {
        p_payload: payload,
        p_request_id: pendingSubmission.current.id,
      });
      if (error) {
        throw new Error(
          error.code === "22023"
            ? error.message
            : "資料儲存失敗，請稍後再試或聯絡管理員。",
        );
      }
      if (
        !result?.inviteCode ||
        !Number.isFinite(Date.parse(result.expiration))
      ) {
        throw new Error("伺服器回應格式錯誤，請聯絡管理員。");
      }
      const receipt = {
        code: result.inviteCode,
        expiration: new Date(result.expiration),
      };
      completeDraft(receipt);
      setInviteResult(receipt);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Submission failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "資料提交失敗，請稍後再試。";
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess && inviteResult)
    return (
      <>
        <Header examYear={formData.examYear} />
        <div className="min-h-screen grid-pattern px-4 pt-28 pb-12">
          <StudentResult
            result={inviteResult}
            now={clockNow}
            storageNotice={storageError}
            onStartAgain={() => {
              resetDraft();
              setIsSuccess(false);
              setInviteResult(null);
              setSubmitError("");
            }}
          />
        </div>
      </>
    );

  if (settingsLoading)
    return (
      <>
        <Header examYear={formData.examYear} />
        <main className="max-w-xl mx-auto px-6 pt-32">
          <h1 className="text-2xl font-black">會考序位調查問卷</h1>
          <p role="status" className="mt-4">
            正在載入問卷設定…
          </p>
        </main>
      </>
    );

  if (settingsError) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header examYear={formData.examYear} />
        <main role="alert" className="max-w-xl mx-auto px-6 pt-32 text-center">
          <h1 className="text-2xl font-black">暫時無法載入問卷</h1>
          <p className="mt-4 text-slate-600">
            請稍後重新載入。若持續出現此訊息，請聯絡管理員。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 border-2 border-slate-900 bg-white px-6 py-3 font-bold"
          >
            重新載入
          </button>
        </main>
      </div>
    );
  }

  if (!isSystemActive) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans text-slate-900 border-8 border-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white border-4 border-slate-900 p-8 shadow-[8px_8px_0_#0F172A] max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 text-slate-900 flex items-center justify-center border-4 border-slate-900 rounded-full">
            <span className="text-3xl font-black">!</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">
            系統未開放
          </h1>
          <p className="font-bold text-slate-600 mb-6">
            目前的系統設定為不開放填寫，或尚未到達/已超過開放時間。
            <br />
            請稍後再登入或聯繫管理員。
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        examYear={formData.examYear}
        onShareClick={() => setShowShareModal(true)}
      />
      <div className="min-h-screen grid-pattern pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
        <aside
          className={`max-w-3xl mx-auto mb-4 border-2 p-4 text-sm ${announcement.before ? "border-slate-300 bg-slate-50" : "border-blue-200 bg-blue-50"}`}
          aria-label="所選年度公告"
        >
          <p className="font-bold">{announcement.title}</p>
          <p className="mt-2">{announcement.body}</p>
          {/^https?:\/\//i.test(announcement.linkUrl) && (
            <a
              className="inline-block min-h-11 pt-3 underline font-bold"
              href={announcement.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {announcement.linkLabel}
            </a>
          )}
        </aside>
        <StudentSurvey
          data={formData}
          setData={setFormData}
          rules={{
            years: examYears,
            scoresActive: isSubjectScoreActive,
            forceSkipRanking,
            questions: activeCustomQuestions,
          }}
          onSubmit={handleConfirmSubmit}
          submitting={isSubmitting}
          submitError={submitError}
          remember={remember}
          setRemember={setRemember}
          recoveryMessage={recoveryMessage}
          storageError={storageError}
          persistentDraft={persistentDraft}
          restoreDraft={restoreRemembered}
          clearDraft={clearDraft}
        />
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t-8 border-emerald-400 py-6 px-4 sm:px-6 lg:px-8 mt-12 relative z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-400 flex items-center justify-center -rotate-6 shadow-[2px_2px_0_#34D399] border-2 border-transparent">
              <Atom className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-white font-black tracking-widest text-sm">
              全國會考分析系統
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-bold text-slate-400">
            <button
              onClick={() => setShowShareModal(true)}
              className="hover:text-emerald-400 transition-colors"
            >
              分享系統
            </button>
            <Link
              to="/guide"
              className="hover:text-emerald-400 transition-colors"
            >
              使用說明
            </Link>
            <Link
              to="/privacy"
              className="hover:text-emerald-400 transition-colors"
            >
              隱私權政策
            </Link>
            <Link
              to="/disclaimer"
              className="hover:text-emerald-400 transition-colors"
            >
              免責聲明
            </Link>
            <a
              href="mailto:tyctw.analyze@gmail.com"
              className="hover:text-emerald-400 transition-colors"
            >
              聯絡我們
            </a>
          </div>

          <div className="text-xs font-bold text-slate-500 tracking-wider">
            &copy; {new Date().getFullYear()} 全國會考分析系統
          </div>
        </div>
      </footer>

      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-900 p-8 max-w-md w-full shadow-[8px_8px_0_#0F172A] relative text-center">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full border-2 border-blue-200 mb-4">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black tracking-tight mb-2">
              分享本系統
            </h3>
            <p className="text-sm font-bold text-slate-500 mb-6">
              掃描 QRCode 或是複製連結分享給其他人
            </p>

            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white border-4 border-slate-900 rounded-xl inline-block shadow-[4px_4px_0_#0F172A]">
                <QRCodeSVG
                  value={window.location.href}
                  size={160}
                  bgColor={"#ffffff"}
                  fgColor={"#0f172a"}
                  level={"M"}
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
              <button
                onClick={() =>
                  window.open(
                    `https://line.me/R/msg/text/?${encodeURIComponent("推薦這個落點分析系統！ \n" + window.location.href)}`,
                    "_blank",
                  )
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-[#00b900] flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                  <MessageCircle className="w-5 h-5 fill-current" />
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  LINE
                </span>
              </button>
              <button
                onClick={() =>
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
                    "_blank",
                  )
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-[#1877f2] flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                  <Facebook className="w-5 h-5 fill-current" />
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  Facebook
                </span>
              </button>
              <button
                onClick={() =>
                  window.open(
                    `https://threads.net/intent/post?text=${encodeURIComponent("推薦這個落點分析系統！ \n" + window.location.href)}`,
                    "_blank",
                  )
                }
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-black flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                  <AtSign className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  Threads
                </span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("已複製網址！請前往 Instagram 貼上分享。");
                  window.open("https://instagram.com", "_blank");
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                  <Instagram className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  Instagram
                </span>
              </button>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("網址已複製！");
              }}
              className="w-full relative group py-3 bg-slate-900 text-white font-black overflow-hidden"
            >
              <div className="absolute inset-0 bg-blue-600 -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-300"></div>
              <span className="relative flex justify-center items-center gap-2">
                <Copy className="w-5 h-5" />
                複製網址連結
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
export function StudentResult({
  result,
  now,
  onStartAgain,
  storageNotice,
}: {
  storageNotice: string;
  result: { code: string; expiration: Date };
  now: number;
  onStartAgain: () => void;
}) {
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  const remaining = Math.max(
    0,
    Math.ceil((result.expiration.getTime() - now) / 1000),
  );
  const expired = remaining === 0;
  const url = `https://tyctw.github.io/spare/?invite=${encodeURIComponent(result.code)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("無法自動複製，請手動選取下方連結。");
    }
  };
  return (
    <main className="student-result">
      <div className="student-receipt-stamp" aria-hidden="true">
        <ArrowUpRight size={24} />
      </div>
      <p className="student-eyebrow">資料已成功送出</p>
      <h1 className="student-title">
        {expired ? "邀請碼已到期" : "落點分析邀請碼"}
      </h1>
      <p className="mt-4 text-slate-600">
        {expired
          ? "這次填答已完成，資料不會因邀請碼到期而消失。需要新碼時可重新填寫。"
          : "請於到期前前往分析系統。此頁會嘗試在本分頁保存送出結果，請先複製分析連結。"}
      </p>
      {storageNotice && (
        <p role="alert" className="mt-4 text-amber-800">
          {storageNotice}
        </p>
      )}
      <p
        className="student-ticket font-mono break-all select-all"
        aria-label="邀請碼"
      >
        {result.code}
      </p>
      <dl className="student-result-details">
        <div>
          <dt className="font-bold">到期時間（台北時間）</dt>
          <dd>
            {result.expiration.toLocaleString("zh-TW", {
              timeZone: "Asia/Taipei",
              hour12: false,
            })}
          </dd>
        </div>
        <div>
          <dt className="font-bold">剩餘時間</dt>
          <dd
            role="timer"
            aria-live="off"
            className={`text-2xl font-black ${remaining < 300 ? "text-rose-700" : "text-emerald-800"}`}
          >
            {expired
              ? "已到期"
              : `${Math.floor(remaining / 60)} 分 ${String(remaining % 60).padStart(2, "0")} 秒`}
          </dd>
        </div>
      </dl>
      {expired ? (
        <p
          role="alert"
          className="mt-5 border-2 border-amber-400 bg-amber-50 p-4"
        >
          邀請連結已到期，請勿繼續使用舊連結。您可以自行決定是否重新填寫。
        </p>
      ) : (
        remaining <= 300 && (
          <p role="status" className="mt-5 text-rose-700 font-bold">
            邀請碼即將到期，請盡快使用。
          </p>
        )
      )}
      <div className="mt-8 space-y-3">
        {expired ? (
          <button
            disabled
            className="student-secondary-button student-expired-button w-full"
          >
            前往分析（已到期）
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="student-primary-button w-full"
          >
            前往分析 <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        )}
        {!expired && (
          <>
            <button
              type="button"
              onClick={copy}
              className="student-secondary-button w-full"
            >
              {copied ? "已複製分析連結" : "複製分析連結"}
            </button>
            <p role="status" className="text-sm text-red-700">
              {copyError}
            </p>
            {copyError && (
              <input
                readOnly
                aria-label="分析連結"
                value={url}
                onFocus={(event) => event.target.select()}
                className="student-input"
              />
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => {
            if (
              expired ||
              window.confirm("確定重新填寫？目前邀請連結將從本分頁移除。")
            )
              onStartAgain();
          }}
          className="w-full min-h-12 p-3 underline"
        >
          重新填寫
        </button>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        系統資料僅供參考，實際招生與分發規則以官方公告為準。請勿公開分享邀請連結。
      </p>
    </main>
  );
}

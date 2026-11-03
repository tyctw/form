import { useEffect, useRef, useState } from "react";
import type { QuestionnaireData } from "../types";
import {
  SESSION_DRAFT_KEY,
  REMEMBERED_DRAFT_KEY,
  RESULT_KEY,
  DRAFT_TTL,
  readDraft,
  writeDraft,
  removeStored,
  decodeResult,
  hasDraftInput,
  type PendingSubmission,
  type StudentDraft,
} from "../utils/studentSurvey";
function storage(kind: "sessionStorage" | "localStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}
export function useStudentDraft(initial: QuestionnaireData) {
  const [recovered] = useState(() => {
    const session = storage("sessionStorage"),
      local = storage("localStorage");
    const draft = session
      ? readDraft(session, SESSION_DRAFT_KEY, initial)
      : null;
    let result = null;
    try {
      const raw = session?.getItem(RESULT_KEY) || null;
      result = decodeResult(raw);
      if (raw && !result && session) removeStored(session, RESULT_KEY);
    } catch {}
    return {
      draft,
      result,
      remembered:
        !draft && local
          ? readDraft(local, REMEMBERED_DRAFT_KEY, initial)
          : null,
    };
  });
  const [formData, setFormData] = useState<QuestionnaireData>(
    recovered.draft?.data || structuredClone(initial),
  );
  const [remember, setRemember] = useState(recovered.draft?.remember || false);
  const [persistentDraft, setPersistentDraft] = useState(recovered.remembered);
  const [recoveryMessage, setRecoveryMessage] = useState(
    recovered.draft ? "已恢復本分頁尚未送出的草稿。" : "",
  );
  const [storageError, setStorageError] = useState("");
  const pendingSubmission = useRef<PendingSubmission | null>(
    recovered.draft?.pending || null,
  );
  const submitted = useRef(!!recovered.result);
  const makeRecord = (pending: PendingSubmission | null): StudentDraft => {
    const savedAt = Date.now();
    return {
      version: 1,
      savedAt,
      expiresAt: savedAt + DRAFT_TTL,
      remember,
      data: formData,
      pending,
    };
  };
  const save = (pending: PendingSubmission | null) => {
    const session = storage("sessionStorage"),
      local = storage("localStorage");
    const record = makeRecord(pending);
    let ok = !!session && writeDraft(session, SESSION_DRAFT_KEY, record);
    if (remember)
      ok = !!local && writeDraft(local, REMEMBERED_DRAFT_KEY, record) && ok;
    // A remembered draft is offered until explicitly restored/deleted; do not silently overwrite it.
    else if (!persistentDraft && local)
      ok = removeStored(local, REMEMBERED_DRAFT_KEY) && ok;
    setStorageError(
      ok
        ? ""
        : "此瀏覽器無法保存草稿，關閉或重新整理後可能無法恢復。請先完成送出。",
    );
  };
  useEffect(() => {
    if (
      submitted.current ||
      (!hasDraftInput(formData, initial) &&
        !remember &&
        !pendingSubmission.current)
    )
      return;
    save(pendingSubmission.current);
  }, [formData, remember]);
  const savePending = (pending: PendingSubmission) => {
    pendingSubmission.current = pending;
    save(pending);
  };
  const clearDraft = () => {
    const session = storage("sessionStorage"),
      local = storage("localStorage");
    const sessionCleared =
      !!session && removeStored(session, SESSION_DRAFT_KEY);
    const localCleared = !!local && removeStored(local, REMEMBERED_DRAFT_KEY);
    const ok = sessionCleared && localCleared;
    pendingSubmission.current = null;
    submitted.current = false;
    setFormData(structuredClone(initial));
    setRemember(false);
    setPersistentDraft(null);
    setRecoveryMessage("已清除草稿與本機保存的填寫內容。");
    setStorageError(
      ok ? "" : "無法清除瀏覽器儲存空間，請透過瀏覽器設定清除本站資料。",
    );
  };
  const restoreRemembered = () => {
    if (!persistentDraft) return;
    // Re-check expiry at the time of restoration, not only at initial page load.
    if (persistentDraft.expiresAt <= Date.now()) {
      const local = storage("localStorage");
      if (local) removeStored(local, REMEMBERED_DRAFT_KEY);
      setPersistentDraft(null);
      setRecoveryMessage("保存的草稿已到期；您目前的填寫內容仍保留。");
      return;
    }
    if (
      hasDraftInput(formData, initial) &&
      !window.confirm("確定用保存的草稿取代目前填寫的內容？")
    )
      return;
    setFormData(persistentDraft.data);
    pendingSubmission.current = persistentDraft.pending;
    setRemember(true);
    setPersistentDraft(null);
    setRecoveryMessage("已恢復記住的草稿，送出前請再次確認。");
  };
  const completeDraft = (result: { code: string; expiration: Date }) => {
    submitted.current = true;
    pendingSubmission.current = null;
    const session = storage("sessionStorage"),
      local = storage("localStorage");
    let sessionCleared = false,
      resultSaved = false;
    if (session) {
      sessionCleared = removeStored(session, SESSION_DRAFT_KEY);
      try {
        session.setItem(
          RESULT_KEY,
          JSON.stringify({
            ...result,
            expiration: result.expiration.toISOString(),
            savedAt: Date.now(),
          }),
        );
        resultSaved = true;
      } catch {}
    }
    const localCleared = local
      ? removeStored(local, REMEMBERED_DRAFT_KEY)
      : !remember;
    setStorageError(
      !resultSaved
        ? "填答已送出，但無法在本分頁保存結果；離開前請先複製分析連結。"
        : !sessionCleared || !localCleared
          ? "填答已送出，但無法完全清除本機草稿；共用裝置請清除本站的瀏覽器資料。"
          : "",
    );
    setPersistentDraft(null);
  };
  const resetDraft = () => {
    const session = storage("sessionStorage");
    if (session) removeStored(session, RESULT_KEY);
    clearDraft();
  };
  const toggleRemember = (value: boolean) => {
    setRemember(value);
    if (!value) {
      const local = storage("localStorage");
      if (local && !removeStored(local, REMEMBERED_DRAFT_KEY))
        setStorageError("無法移除記住的草稿，請清除瀏覽器中的本站資料。");
      setPersistentDraft(null);
    }
  };
  return {
    formData,
    setFormData,
    pendingSubmission,
    remember,
    setRemember: toggleRemember,
    persistentDraft,
    restoreRemembered,
    clearDraft,
    resetDraft,
    recoveryMessage,
    storageError,
    savePending,
    completeDraft,
    restoredResult: recovered.result,
  };
}

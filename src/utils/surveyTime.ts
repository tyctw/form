export const TAIPEI_TIME_ZONE = "Asia/Taipei";

export function getExamYears(now = new Date()): string[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  const latest =
    part("year") -
    1911 +
    (part("month") > 7 || (part("month") === 7 && part("day") >= 15) ? 1 : 0);
  return Array.from({ length: 6 }, (_, i) => String(latest - i));
}

// SQL submission uses ::timestamp AT TIME ZONE 'Asia/Taipei': offsets on question
// wall-clock strings are ignored by PostgreSQL, rather than converted as instants.
export function normalizeQuestionTime(value: string): string {
  const wall = value.replace(/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i, "");
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/.test(wall))
    throw new Error("題目時間須使用年月日與時分");
  const normalized = wall.replace(" ", "T");
  const timestamp = Date.parse(normalized + "+08:00");
  const rendered = Number.isFinite(timestamp)
    ? new Date(timestamp + 8 * 3600000).toISOString()
    : "";
  if (rendered.slice(0, 16) !== normalized.slice(0, 16))
    throw new Error("題目日期或時間無效");
  return normalized;
}
export function taipeiQuestionTime(value: string): number {
  try {
    return Date.parse(normalizeQuestionTime(value) + "+08:00");
  } catch {
    return NaN;
  }
}
export function isQuestionActive(
  question: { startTime?: string; endTime?: string },
  now = Date.now(),
): boolean {
  const start = question.startTime
    ? taipeiQuestionTime(question.startTime)
    : null;
  const end = question.endTime ? taipeiQuestionTime(question.endTime) : null;
  if (
    (start !== null && !Number.isFinite(start)) ||
    (end !== null && !Number.isFinite(end))
  )
    return false;
  return (start === null || now >= start) && (end === null || now <= end);
}
export function formatTaipeiTime(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return "未設定";
  const at = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)
    ? Date.parse(value)
    : taipeiQuestionTime(value);
  return Number.isFinite(at)
    ? new Date(at).toLocaleString("zh-TW", {
        timeZone: TAIPEI_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        ...options,
      })
    : "時間格式無效";
}
export const DEFAULT_ANNOUNCEMENT = {
  title: "公告：{examYear} 年度序位區間已開放填寫",
  body: "請依 {examYear} 年度成績單填寫成績與序位資訊；若尚未取得序位，可選擇略過。",
  linkLabel: "前往查詢序位區間",
  linkUrl: "https://tyctw.github.io/volunteer/",
};
const LEGACY_TITLE = "公告：115年度序位區間已開放查詢";
export function announcementForYear(
  content: typeof DEFAULT_ANNOUNCEMENT,
  year: string,
  latest: string,
  announcementDate: string | null,
  now = Date.now(),
) {
  const announcementAt = announcementDate ? Date.parse(announcementDate) : NaN;
  const before =
    year === latest && Number.isFinite(announcementAt) && now < announcementAt;
  if (year !== latest)
    return {
      before: false,
      title: `${year} 年度資料填寫`,
      body: `請依 ${year} 年度成績單填寫。本次不受 ${latest} 年度序位公告時間限制。`,
      linkLabel: "",
      linkUrl: "",
    };
  const replace = (value: string) =>
    value
      .replaceAll("{examYear}", year)
      .replaceAll(
        "{announcementTime}",
        announcementDate
          ? formatTaipeiTime(announcementDate) + "（台北時間）"
          : "未設定",
      );
  if (before)
    return {
      before: true,
      title: `${year} 年度序位尚未開放`,
      body: `序位將於 ${formatTaipeiTime(announcementDate!)}（台北時間）開放；目前可先填寫其他資料。`,
      linkLabel: "",
      linkUrl: "",
    };
  return {
    before: false,
    title: replace(
      content.title === LEGACY_TITLE
        ? DEFAULT_ANNOUNCEMENT.title
        : content.title,
    ),
    body: replace(content.body),
    linkLabel: replace(content.linkLabel),
    linkUrl: content.linkUrl,
  };
}

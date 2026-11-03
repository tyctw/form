import { DEFAULT_ANNOUNCEMENT, normalizeQuestionTime } from './surveyTime.ts';
export { DEFAULT_ANNOUNCEMENT } from './surveyTime.ts';
export type SettingsDraft = {
  announcement_date: string;
  announcement_content: typeof DEFAULT_ANNOUNCEMENT;
  custom_questions: any[];
  subject_score_start_time: string;
  subject_score_end_time: string;
  subject_score_enabled: boolean;
  system_start_time: string;
  system_end_time: string;
  system_enabled: boolean;
};
export function taipeiInput(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 23).replace(/\.000$/, '').replace(/:00$/, '');
}
export function taipeiISO(value: string): string | null {
  return value ? new Date(value + '+08:00').toISOString() : null;
}
export function toSettingsDraft(raw: Record<string, any> | null): SettingsDraft {
  return {
    announcement_date: raw ? taipeiInput(raw.announcement_date) : '',
    announcement_content: { ...DEFAULT_ANNOUNCEMENT, ...raw?.announcement_content },
    custom_questions: (raw?.custom_questions || []).filter((q: any) => q.id !== '__SYSTEM_BACKUPS__').map((q: any) => ({ ...q, ...(q.startTime ? {startTime:normalizeQuestionTime(q.startTime)} : {}), ...(q.endTime ? {endTime:normalizeQuestionTime(q.endTime)} : {}) })),
    subject_score_start_time: taipeiInput(raw?.subject_score_start_time),
    subject_score_end_time: taipeiInput(raw?.subject_score_end_time),
    subject_score_enabled: raw ? raw.subject_score_enabled === true : true,
    system_start_time: taipeiInput(raw?.system_start_time),
    system_end_time: taipeiInput(raw?.system_end_time), system_enabled: raw ? raw.system_enabled === true : true,
  };
}
export function settingsPayload(draft: SettingsDraft) {
  return { ...draft, announcement_date: taipeiISO(draft.announcement_date),
    subject_score_start_time: taipeiISO(draft.subject_score_start_time),
    subject_score_end_time: taipeiISO(draft.subject_score_end_time),
    system_start_time: taipeiISO(draft.system_start_time), system_end_time: taipeiISO(draft.system_end_time) };
}
export function settingsIssues(draft: SettingsDraft) {
  const errors: string[] = [], warnings: string[] = [];
  const at = (value: string) => Date.parse(value + '+08:00');
  const checkRange = (label: string, start: string, end: string) => {
    if ((start && !Number.isFinite(Date.parse(start + '+08:00'))) || (end && !Number.isFinite(Date.parse(end + '+08:00')))) errors.push(`${label}日期無效`);
    if (start && end && at(start) >= at(end)) errors.push(`${label}開始時間必須早於結束時間`);
  };
  checkRange('表單', draft.system_start_time, draft.system_end_time);
  checkRange('成績輸入', draft.subject_score_start_time, draft.subject_score_end_time);
  if (draft.announcement_date && !Number.isFinite(Date.parse(draft.announcement_date + '+08:00'))) errors.push('序位公告日期無效');
  if (draft.subject_score_enabled && ((draft.system_end_time && draft.subject_score_start_time && at(draft.subject_score_start_time) > at(draft.system_end_time))
    || (draft.system_start_time && draft.subject_score_end_time && at(draft.subject_score_end_time) < at(draft.system_start_time)))) errors.push('成績輸入時間與表單開放時間沒有交集');
  if (draft.system_end_time && at(draft.announcement_date) > at(draft.system_end_time)) warnings.push('序位公告在表單結束之後，這次開放期間將無法填寫當年度序位');
  const ids = new Set<string>();
  draft.custom_questions.forEach((q, i) => {
    const label = `第 ${i + 1} 題`;
    if (!q.id || q.id === '__SYSTEM_BACKUPS__' || ids.has(q.id)) errors.push(`${label}識別碼重複或無效`);
    ids.add(q.id);
    if (!q.question?.trim()) errors.push(`${label}缺少題目文字`);
    if (!['text','radio','checkbox'].includes(q.type)) errors.push(`${label}類型無效`);
    if (q.type !== 'text' && (!q.options?.length || q.options.some((x: string) => !x.trim()) || new Set(q.options).size !== q.options.length)) errors.push(`${label}選項不可空白或重複`);
    checkRange(label, q.startTime || '', q.endTime || '');
    if ((draft.system_end_time && q.startTime && at(q.startTime) > at(draft.system_end_time))
      || (draft.system_start_time && q.endTime && at(q.endTime) < at(draft.system_start_time))) errors.push(`${label}時間與表單開放時間沒有交集`);
  });
  if (draft.announcement_content.linkUrl && !/^https?:\/\//i.test(draft.announcement_content.linkUrl)) errors.push('公告連結須使用 http 或 https');
  return { errors, warnings };
}
export function settingsDiff(before: SettingsDraft, after: SettingsDraft) {
  const changes: { label: string; before: string; after: string }[] = [];
  const add = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ label, before: String(a ?? '') || '未設定', after: String(b ?? '') || '未設定' });
  };
  for (const [key, label] of [
    ['system_enabled','表單開關'],['system_start_time','表單開始時間'],['system_end_time','表單結束時間'],
    ['subject_score_enabled','成績輸入開關'],['subject_score_start_time','成績輸入開始時間'],['subject_score_end_time','成績輸入結束時間'],['announcement_date','序位公告時間'],
  ] as const) add(label, typeof before[key] === 'boolean' ? before[key] ? '開啟' : '關閉' : before[key], typeof after[key] === 'boolean' ? after[key] ? '開啟' : '關閉' : after[key]);
  for (const [key,label] of [['title','公告標題'],['body','公告說明'],['linkLabel','按鈕文字'],['linkUrl','公告連結']] as const) add(label,before.announcement_content[key],after.announcement_content[key]);
  const describe = (q: any) => q ? `${q.question}｜${({text:'簡答',radio:'單選',checkbox:'複選'} as any)[q.type]}｜${q.required?'必填':'選填'}｜選項：${(q.options||[]).join('、')}｜${q.startTime||'不限開始'} ～ ${q.endTime||'不限結束'}` : '無此題目';
  const ids = new Set([...before.custom_questions,...after.custom_questions].map(q=>q.id));
  for (const id of ids) {
    const a=before.custom_questions.find(q=>q.id===id), b=after.custom_questions.find(q=>q.id===id);
    add(`題目：${b?.question || a?.question || id}`, describe(a),describe(b));
  }
  if (JSON.stringify(before.custom_questions.map(q=>q.id)) !== JSON.stringify(after.custom_questions.map(q=>q.id))) changes.push({label:'題目順序',before:before.custom_questions.map(q=>q.question).join(' → ') || '無題目',after:after.custom_questions.map(q=>q.question).join(' → ') || '無題目'});
  return changes;
}

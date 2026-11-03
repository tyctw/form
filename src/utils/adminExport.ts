import { toCsvCell } from './spreadsheet.ts';
export const EXPORT_FIELDS = [
  ['timestamp','填寫時間'],['examYear','會考年度'],['region','招生區'],['identity','身分'],
  ['chineseScore','國文'],['mathScore','數學'],['englishScore','英文'],['socialScore','社會'],['scienceScore','自然'],['essayScore','作文'],
  ['minRatio','最小比率(%)'],['maxRatio','最大比率(%)'],['minRankInterval','最小區間'],['maxRankInterval','最大區間'],
  ['email','Email'],['inviteCode','邀請碼'],['custom_answers','自訂題目回答'],
] as const;
export type ExportField = typeof EXPORT_FIELDS[number][0];
export function maskEmail(value: unknown): string {
  return value == null || value === '' ? '' : '***@***';
}
export function exportCsvRow(row: Record<string, any>, fields: ExportField[], includePersonal: boolean, answers: (value: unknown) => string): string {
  return fields.map(field => {
    let value = row[field] ?? '';
    if (field === 'email' && !includePersonal) value = maskEmail(value);
    if (field === 'timestamp') value = new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    if (field === 'custom_answers') value = answers(value);
    return toCsvCell(value);
  }).join(',');
}

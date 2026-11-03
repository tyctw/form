import { normalizeQuestionTime } from './surveyTime.ts';
import type { CustomQuestion } from '../types';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Treat malformed settings as unavailable, rather than crashing during React rendering
// or silently dropping required questions from the questionnaire.
export function parseSurveyConfig(value: unknown, depth = 0): Record<string, any> {
  if (!record(value) || depth > 1) throw new Error('問卷設定格式錯誤');
  const result = { ...value };
  for (const key of ['system_enabled', 'subject_score_enabled']) {
    if (value[key] != null && typeof value[key] !== 'boolean') throw new Error('問卷開關格式錯誤');
  }
  for (const key of ['announcement_date', 'subject_score_start_time', 'subject_score_end_time',
    'system_start_time', 'system_end_time', 'timestamp']) {
    if (value[key] != null && (typeof value[key] !== 'string' || !Number.isFinite(Date.parse(value[key])))) {
      throw new Error('問卷日期格式錯誤');
    }
  }
  if (value.announcement_content != null) {
    if (!record(value.announcement_content)) throw new Error('公告格式錯誤');
    for (const key of ['title', 'body', 'linkLabel', 'linkUrl']) {
      const field = value.announcement_content[key];
      if (field !== undefined && typeof field !== 'string') throw new Error('公告內容格式錯誤');
    }
  }
  if (value.custom_questions == null) {
    result.custom_questions = [];
    return result;
  }
  if (!Array.isArray(value.custom_questions)) throw new Error('自訂題目格式錯誤');
  const ids = new Set<string>();
  result.custom_questions = value.custom_questions.map((question: unknown) => {
    if (!record(question) || typeof question.id !== 'string' || !question.id || ids.has(question.id)) {
      throw new Error('自訂題目識別碼格式錯誤');
    }
    ids.add(question.id);
    if (question.id === '__SYSTEM_BACKUPS__') {
      if (depth > 0 || !Array.isArray(question.data)) throw new Error('備份資料格式錯誤');
      return { id: question.id, data: question.data.map(backup => parseSurveyConfig(backup, depth + 1)) };
    }
    if (!['text', 'radio', 'checkbox'].includes(String(question.type))
      || typeof question.question !== 'string'
      || (question.required != null && typeof question.required !== 'boolean')) {
      throw new Error('自訂題目內容格式錯誤');
    }
    if (question.type !== 'text' && (!Array.isArray(question.options)
      || !question.options.every(option => typeof option === 'string'))) {
      throw new Error('自訂題目選項格式錯誤');
    }
    const normalized = { ...question };
    for (const key of ['startTime', 'endTime']) {
      if (question[key] != null && question[key] !== ''
        && (typeof question[key] !== 'string' || !Number.isFinite(Date.parse(question[key])))) {
        throw new Error('自訂題目日期格式錯誤');
      }
      if (typeof question[key] === 'string' && question[key]) normalized[key] = normalizeQuestionTime(question[key]);
    }
    return { ...normalized, required: question.required ?? false } as unknown as CustomQuestion;
  });
  return result;
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSurveyConfig } from '../src/utils/surveyConfig.ts';

test('valid closed settings, questions and backups keep their meaning', () => {
  const questions = [{ id: 'q', type: 'checkbox', question: '選項', options: ['A', 'B'], required: true }];
  const config = { system_enabled: false, announcement_date: '2026-10-17T12:00:00+08:00',
    custom_questions: [...questions, { id: '__SYSTEM_BACKUPS__', data: [{ custom_questions: questions }] }] };
  assert.deepEqual(parseSurveyConfig(config), config);
  assert.deepEqual(parseSurveyConfig({}).custom_questions, []);
});

test('malformed settings are rejected before entering render state', () => {
  for (const config of [null, [], { system_enabled: 'false' }, { announcement_date: 'bad-date' },
    { announcement_content: { body: {} } }, { custom_questions: {} }, { custom_questions: [null] },
    { custom_questions: [{ id: 'q', type: 'radio', question: 'q', options: {} }] },
    { custom_questions: [{ id: 'q', type: 'radio', question: 'q', options: [null] }] },
    { custom_questions: [{ id: 'q', type: 'text', question: {} }] },
    { custom_questions: [{ id: 'q', type: 'text', question: 'q', startTime: 'bad-date' }] },
    { custom_questions: [{ id: '__SYSTEM_BACKUPS__', data: {} }] },
    { custom_questions: [{ id: 'q', type: 'text', question: 'q' }, { id: 'q', type: 'text', question: 'q' }] },
  ]) assert.throws(() => parseSurveyConfig(config));
});

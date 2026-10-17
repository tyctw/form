import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { createSurveyPayload } from '../src/utils/surveySubmission.ts';

test('client sends only submission fields, hides inactive answers, and preserves raw numbers for validation', () => {
  const data = {
    region: '基北區', examYear: '116', identity: '學生', email: 'test@example.invalid',
    chineseScore: 'A', mathScore: 'A', englishScore: 'A', socialScore: 'A', scienceScore: 'A', essayScore: '6',
    minRatio: '2abc', maxRatio: '5', minRankInterval: '1.9', maxRankInterval: '100',
    customAnswers: { active: 'answer', expired: 'old answer' },
    timestamp: 'forged', inviteCode: 'forged',
  };
  const skipped = createSurveyPayload(data, true, false, ['active']);
  assert.deepEqual(skipped.custom_answers, { active: 'answer' });
  assert.equal(skipped.chineseScore, '');
  assert.equal(skipped.skipRanking, true);
  for (const key of ['timestamp', 'inviteCode', 'minRatio', 'maxRatio', 'minRankInterval', 'maxRankInterval']) {
    assert.equal(Object.hasOwn(skipped, key), false);
  }
  const full = createSurveyPayload(data, false, true, ['active']);
  assert.equal(full.minRatio, '2abc');
  assert.equal(full.minRankInterval, '1.9');
  assert.equal(full.chineseScore, 'A');
});

function gasFixture({ configured = true, code = 200, response = { inviteCode: 'SH2026101713', expiration: '2026-10-17T06:00:00Z' } } = {}) {
  const calls = [];
  const context = vm.createContext({
    ContentService: { createTextOutput: text => ({ setMimeType: () => text }), MimeType: { JSON: 'json' } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => configured
      ? ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' })[key] : null }) },
    Utilities: { getUuid: () => '00000000-0000-0000-0000-000000000001' },
    UrlFetchApp: { fetch: (url, options) => {
      calls.push({ url, options });
      return { getResponseCode: () => code, getContentText: () => JSON.stringify(response) };
    } },
    SpreadsheetApp: { openById: () => { throw new Error('Submission must never write directly to sheets'); } },
  });
  vm.runInContext(fs.readFileSync(new URL('../GAS_Backend.js', import.meta.url), 'utf8'), context);
  return { context, calls, post: value => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(value) } })) };
}

test('GAS forwards through the same validated RPC and preserves the request ID', () => {
  const { calls, post } = gasFixture();
  const result = post({ requestId: 'client-id', region: '基北區', skipRanking: true, custom_answers: {} });
  assert.equal(result.status, 'success');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://test.supabase.co/rest/v1/rpc/submit_survey');
  assert.deepEqual(JSON.parse(calls[0].options.payload), {
    p_payload: { region: '基北區', skipRanking: true, custom_answers: {} }, p_request_id: 'client-id',
  });
  assert.equal(calls[0].options.followRedirects, false);
});

test('GAS fails closed when unconfigured, malformed, oversized, or rejected by validation', () => {
  const fixture = gasFixture({ configured: false });
  assert.equal(fixture.post({ region: '基北區' }).status, 'error');
  assert.equal(fixture.calls.length, 0);
  for (const value of [null, [], 'text', { value: 'a'.repeat(32769) }]) {
    assert.equal(fixture.post(value).status, 'error');
  }
  const invalid = gasFixture({ code: 400, response: { code: '22023', message: '表單目前未開放' } });
  assert.deepEqual(invalid.post({}), { status: 'error', message: '表單目前未開放' });
  const internal = gasFixture({ code: 500, response: { message: 'private database details' } });
  assert.equal(JSON.stringify(internal.post({})).includes('private database details'), false);
});

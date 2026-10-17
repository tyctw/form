// node tests/survey-submission.cjs <path to @electric-sql/pglite>
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY); CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY, payload json, created_at timestamptz, ip_address varchar(64));
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
    `);
    await db.exec(fs.readFileSync(path.join(root, 'supabase_schema.sql'), 'utf8'));
    const migration = fs.readFileSync(path.join(root, 'migrations/003_validated_survey_submission.sql'), 'utf8');
    await db.exec(`
      -- Simulate existing public INSERT policies and column grants before upgrade.
      GRANT ALL ON public.survey_responses_full, public.survey_responses_skip_ranking TO anon, authenticated;
      GRANT INSERT (region, "examYear") ON public.survey_responses_full, public.survey_responses_skip_ranking TO anon;
      CREATE POLICY legacy_all ON public.survey_responses_full FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY legacy_all ON public.survey_responses_skip_ranking FOR ALL USING (true) WITH CHECK (true);
    `);
    await db.exec(migration); await db.exec(migration);
    const { rows: [clock] } = await db.query(`SELECT
      (extract(year FROM now() AT TIME ZONE 'Asia/Taipei')::int - 1911 +
       CASE WHEN to_char(now() AT TIME ZONE 'Asia/Taipei','MMDD') >= '0715' THEN 1 ELSE 0 END)::text AS year`);
    let serial = 0;
    const base = () => ({ region: '基北區', examYear: clock.year, identity: '學生',
      chineseScore: 'A++', mathScore: 'A', englishScore: 'B+', socialScore: 'B', scienceScore: 'C',
      essayScore: '0', email: `test${++serial}@example.invalid`, skipRanking: true, custom_answers: {} });
    async function asRole(role, callback, commit = false) {
      await db.exec('BEGIN');
      try {
        await db.exec(`SET LOCAL ROLE ${role}`);
        const result = await callback();
        await db.exec(commit ? 'COMMIT' : 'ROLLBACK');
        return result;
      } catch (error) { await db.exec('ROLLBACK'); throw error; }
    }
    const submit = (payload, id = randomUUID(), commit = false, role = 'anon') => asRole(role,
      () => db.query('SELECT public.submit_survey($1::jsonb, $2::uuid) AS result', [JSON.stringify(payload), id]), commit);
    const bad = async payload => {
      const before = (await db.query('SELECT count(*) FROM public.survey_submission_receipts')).rows[0].count;
      await assert.rejects(submit(payload), error => error.code === '22023');
      assert.equal((await db.query('SELECT count(*) FROM public.survey_submission_receipts')).rows[0].count, before);
    };
    assert.ok((await submit(base())).rows[0].result.inviteCode.startsWith('SH'));
    assert.ok((await submit(base(), randomUUID(), false, 'authenticated')).rows[0].result.expiration);
    const full = { ...base(), skipRanking: false, minRatio: '0', maxRatio: '100', minRankInterval: '1', maxRankInterval: '100' };
    await submit(full);
    for (const patch of [
      { region: '不存在' }, { identity: 'root' }, { examYear: '999' }, { examYear: '1e2' },
      { email: 'invalid' }, { email: 'a\r\nb@example.invalid' }, { email: 'a'.repeat(255) },
      { chineseScore: 'S' }, { chineseScore: '' }, { essayScore: '7' }, { mathScore: {} },
      { skipRanking: 'true' }, { skipRanking: null }, { custom_answers: [] },
      { timestamp: '2000-01-01' }, { inviteCode: 'forged' }, { unexpected: 'x' },
    ]) await bad({ ...base(), ...patch });
    for (const field of ['region', 'examYear', 'identity', 'email', 'skipRanking']) {
      const payload = base(); delete payload[field]; await bad(payload);
    }
    await bad(null); await bad([]); await bad({ ...base(), custom_answers: { x: 'a'.repeat(33000) } });
    for (const patch of [
      { minRatio: '-1' }, { maxRatio: '101' }, { minRatio: '51', maxRatio: '50' },
      { minRatio: 'NaN' }, { minRatio: {} }, { minRatio: null },
      { minRankInterval: '0' }, { minRankInterval: '1.5' }, { minRankInterval: '2abc' },
      { minRankInterval: '101' }, { maxRankInterval: '2147483648' }, { maxRankInterval: '9'.repeat(100) },
    ]) await bad({ ...full, email: base().email, ...patch });
    const missingRank = { ...full }; delete missingRank.minRatio; await bad(missingRank);
    await bad({ ...base(), minRatio: '1' });

    for (const sql of [
      'system_enabled = false', "system_start_time = now() + interval '1 day'",
      "system_end_time = now() - interval '1 day'",
    ]) {
      await db.exec(`UPDATE public.survey_config SET ${sql}`);
      await bad(base());
      await db.exec('UPDATE public.survey_config SET system_enabled = true, system_start_time = null, system_end_time = null');
    }
    await db.exec("UPDATE public.survey_config SET announcement_date = now() + interval '1 day'");
    await bad({ ...full, email: base().email });
    await submit(base());
    await db.exec('UPDATE public.survey_config SET announcement_date = null');
    for (const sql of ['subject_score_enabled = false',
      "subject_score_start_time = now() + interval '1 day'", "subject_score_end_time = now() - interval '1 day'"]) {
      await db.exec(`UPDATE public.survey_config SET ${sql}`);
      await bad(base());
      const noScores = base();
      for (const key of ['chineseScore','mathScore','englishScore','socialScore','scienceScore','essayScore']) noScores[key] = '';
      await submit(noScores);
      await db.exec('UPDATE public.survey_config SET subject_score_enabled = true, subject_score_start_time = null, subject_score_end_time = null');
    }

    const questions = [
      { id: 'text', type: 'text', required: true },
      { id: 'radio', type: 'radio', options: ['A', 'B'], required: true },
      { id: 'check', type: 'checkbox', options: ['X', 'Y'], required: true },
      { id: 'future', type: 'text', required: true, startTime: '2999-01-01T00:00' },
      { id: 'past', type: 'text', required: true, endTime: '2000-01-01T00:00' },
      { id: '__SYSTEM_BACKUPS__', data: [{ custom_questions: [] }] },
    ];
    await db.query('UPDATE public.survey_config SET custom_questions = $1::jsonb', [JSON.stringify(questions)]);
    const goodAnswers = { text: '正常回答', radio: 'A', check: ['X', 'Y'] };
    await submit({ ...base(), custom_answers: goodAnswers });
    for (const answers of [{}, { ...goodAnswers, text: ' ' }, { ...goodAnswers, text: {} },
      { ...goodAnswers, text: 'a'.repeat(2001) }, { ...goodAnswers, radio: 'C' },
      { ...goodAnswers, check: ['X', 'X'] }, { ...goodAnswers, check: ['Z'] },
      { ...goodAnswers, check: 'X' }, { ...goodAnswers, future: 'bypass' },
      { ...goodAnswers, past: 'bypass' }, { ...goodAnswers, unknown: 'bypass' },
      { ...goodAnswers, __SYSTEM_BACKUPS__: [] },
    ]) await bad({ ...base(), custom_answers: answers });
    await db.exec("UPDATE public.survey_config SET custom_questions = '[]'");

    const payload = base(), requestId = randomUUID();
    const first = await submit(payload, requestId, true);
    assert.deepEqual((await submit(payload, requestId, true)).rows, first.rows);
    await assert.rejects(submit({ ...payload, region: '桃聯區' }, requestId), /識別碼/);
    await assert.rejects(submit({ ...payload, email: payload.email.toUpperCase() }), /60 秒/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.survey_responses_skip_ranking')).rows[0].n, 1);
    const stored = (await db.query('SELECT * FROM public.survey_responses_skip_ranking')).rows[0];
    assert.equal(stored.inviteCode, first.rows[0].result.inviteCode);
    assert.ok(Math.abs(Date.now() - new Date(stored.timestamp).getTime()) < 60000);
    await db.exec("UPDATE public.survey_submission_throttle SET last_at = now() - interval '61 seconds'");
    await submit(payload);
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['survey_responses_full', 'survey_responses_skip_ranking']) {
        await assert.rejects(asRole(role, () => db.exec(`INSERT INTO public.${table} (region, "examYear") VALUES ('test', '115')`)), /permission denied|row-level security/);
        await assert.rejects(asRole(role, () => db.exec(`TRUNCATE public.${table}`)), /permission denied/);
      }
      await assert.rejects(asRole(role, () => db.exec('SELECT * FROM public.survey_submission_throttle')), /permission denied/);
      await assert.rejects(asRole(role, () => db.exec('DELETE FROM public.survey_submission_receipts')), /permission denied/);
    }
    await db.exec('DELETE FROM public.survey_config');
    await bad(base());
    console.log('PASS: server-side validation, configuration windows, question rules, direct-write bypass blocking, normalized-email cooldown, idempotent retries, trusted timestamps, private bookkeeping and repeatable migration.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

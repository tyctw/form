// Run with: node tests/survey-read-access.cjs <path to @electric-sql/pglite>
// Uses an isolated PostgreSQL runtime, never a remote Supabase database.
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY); CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY, payload json, created_at timestamptz, ip_address varchar(64));
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      INSERT INTO auth.users VALUES
        ('00000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0000-000000000002');
    `);
    await db.exec(fs.readFileSync(path.join(root, 'supabase_schema.sql'), 'utf8'));
    await db.exec(`
      INSERT INTO public.survey_admins VALUES ('00000000-0000-0000-0000-000000000001');
      INSERT INTO public.survey_responses_full (region, "examYear", email)
        VALUES ('test', '115', 'private@example.invalid');
      INSERT INTO public.survey_responses_skip_ranking (region, "examYear", email)
        VALUES ('test', '115', 'private@example.invalid');
      GRANT INSERT ON public.survey_responses_full, public.survey_responses_skip_ranking TO anon, authenticated;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
      -- Simulate the original policies and an unexpected permissive ALL policy.
      CREATE POLICY "Allow public select on survey_responses_full"
        ON public.survey_responses_full FOR SELECT USING (true);
      CREATE POLICY "Allow public select on survey_responses_skip_ranking"
        ON public.survey_responses_skip_ranking FOR SELECT USING (true);
      CREATE POLICY legacy_all ON public.survey_responses_full FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY legacy_all ON public.survey_responses_skip_ranking FOR ALL USING (true) WITH CHECK (true);
      GRANT SELECT ON public.survey_responses_full, public.survey_responses_skip_ranking TO anon;
    `);
    const migration = fs.readFileSync(path.join(root, 'migrations/001_private_survey_responses.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Existing deployments can safely reapply this migration.

    async function asUser(role, subject, sql) {
      await db.exec('BEGIN');
      try {
        await db.exec(`SET LOCAL ROLE ${role}`);
        await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [subject]);
        return await db.query(sql);
      } finally {
        await db.exec('ROLLBACK');
      }
    }
    const admin = '00000000-0000-0000-0000-000000000001';
    const user = '00000000-0000-0000-0000-000000000002';
    for (const table of ['survey_responses_full', 'survey_responses_skip_ranking']) {
      await assert.rejects(asUser('anon', '', `SELECT * FROM public.${table}`), /permission denied/);
      assert.equal((await asUser('authenticated', user, `SELECT * FROM public.${table}`)).rows.length, 0);
      assert.equal((await asUser('authenticated', admin, `SELECT * FROM public.${table}`)).rows.length, 1);
      await assert.rejects(asUser('anon', '', `INSERT INTO public.${table} (region, "examYear") VALUES ('test', '115')`), /permission denied|row-level security/);
      // Even a leftover column grant must not expose email through a permissive policy.
      await db.exec(`GRANT SELECT (email) ON public.${table} TO anon`);
      assert.equal((await asUser('anon', '', `SELECT email FROM public.${table}`)).rows.length, 0);
    }
    await assert.rejects(asUser('authenticated', user,
      `INSERT INTO public.survey_admins VALUES ('${user}')`), /permission denied/);
    await assert.rejects(asUser('authenticated', admin, 'SELECT * FROM public.survey_admins'), /permission denied/);
    assert.equal((await asUser('anon', '', 'SELECT public.is_admin() AS allowed')).rows[0].allowed, false);
    assert.equal((await asUser('authenticated', user, 'SELECT public.is_admin() AS allowed')).rows[0].allowed, false);
    assert.equal((await asUser('authenticated', admin, 'SELECT public.is_admin() AS allowed')).rows[0].allowed, true);
    console.log('PASS: anonymous reads denied, ordinary users see no rows, admins can read, direct submission blocked, admin list protected, legacy policy/column-grant bypass blocked, migration repeatable.');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

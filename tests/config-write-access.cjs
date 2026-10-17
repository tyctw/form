// node tests/config-write-access.cjs <path to @electric-sql/pglite>
// Isolated PostgreSQL authorization checks; never connects to production.
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const admin = '00000000-0000-0000-0000-000000000001';
const user = '00000000-0000-0000-0000-000000000002';

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
      INSERT INTO auth.users VALUES ('${admin}'), ('${user}');
    `);
    await db.exec(fs.readFileSync(path.join(root, 'supabase_schema.sql'), 'utf8'));
    await db.exec(`INSERT INTO public.survey_admins VALUES ('${admin}')`);
    // Ensure default identity inserts are possible in the fixture as in a new database.
    await db.exec("SELECT setval(pg_get_serial_sequence('public.survey_config', 'id'), 1)");

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
    async function verify() {
      for (const [role, subject] of [['anon', ''], ['authenticated', user]]) {
        assert.equal((await asUser(role, subject, 'SELECT * FROM public.survey_config')).rows.length, 1);
        await assert.rejects(asUser(role, subject,
          'INSERT INTO public.survey_config (system_enabled) VALUES (false)'), /permission denied|row-level security/);
        // Postgres either rejects the operation at the grant level or updates zero rows under RLS.
        try {
          const result = await asUser(role, subject,
            'UPDATE public.survey_config SET system_enabled = false WHERE id = 1 RETURNING id');
          assert.equal(result.rows.length, 0);
        } catch (error) {
          assert.match(error.message, /permission denied|row-level security/);
        }
        await assert.rejects(asUser(role, subject,
          'TRUNCATE public.survey_config'), /permission denied/);
      }
      assert.equal((await asUser('authenticated', admin,
        'UPDATE public.survey_config SET system_enabled = false WHERE id = 1 RETURNING system_enabled')).rows[0].system_enabled, false);
      assert.equal((await asUser('authenticated', admin,
        'INSERT INTO public.survey_config (system_enabled) VALUES (false) RETURNING system_enabled')).rows[0].system_enabled, false);
      // Verify the management page's insert fallback also works when there is no config row.
      await db.exec('BEGIN');
      try {
        await db.exec(`DELETE FROM public.survey_config; SET LOCAL ROLE authenticated;`);
        await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [admin]);
        assert.equal((await db.query('INSERT INTO public.survey_config (system_enabled) VALUES (true) RETURNING id')).rows.length, 1);
      } finally {
        await db.exec('ROLLBACK');
      }
      assert.equal((await db.query('SELECT system_enabled FROM public.survey_config WHERE id = 1')).rows[0].system_enabled, true);
    }
    await verify(); // Check the new-install schema before testing migrations.

    // Simulate old policies plus additional broad grants and a permissive ALL policy.
    await db.exec(`
      CREATE POLICY "Allow authenticated update on survey_config" ON public.survey_config FOR UPDATE USING (true);
      CREATE POLICY "Allow authenticated insert on survey_config" ON public.survey_config FOR INSERT WITH CHECK (true);
      CREATE POLICY legacy_all ON public.survey_config FOR ALL USING (true) WITH CHECK (true);
      GRANT ALL ON public.survey_config TO PUBLIC, anon, authenticated;
      GRANT INSERT (system_enabled), UPDATE (system_enabled) ON public.survey_config TO anon;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
    `);
    const migration = fs.readFileSync(path.join(root, 'migrations/002_admin_survey_config.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await verify();
    // Leftover DELETE grants cannot defeat the restrictive deletion policy.
    await db.exec('GRANT DELETE ON public.survey_config TO anon, authenticated');
    for (const [role, subject] of [['anon', ''], ['authenticated', user], ['authenticated', admin]]) {
      assert.equal((await asUser(role, subject, 'DELETE FROM public.survey_config RETURNING id')).rows.length, 0);
    }
    // Revoking the allowlist entry immediately revokes write access for an existing JWT.
    await db.exec(`DELETE FROM public.survey_admins WHERE user_id = '${admin}'`);
    assert.equal((await asUser('authenticated', admin,
      'UPDATE public.survey_config SET system_enabled = false RETURNING id')).rows.length, 0);
    console.log('PASS: public config reads preserved; anonymous/ordinary writes and truncation blocked; admins can insert/update including empty-table fallback; legacy policy and column-grant bypass blocked; client deletion blocked; role revocation immediate; migration repeatable.');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

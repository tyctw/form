// node tests/admin-log-access.cjs <path to @electric-sql/pglite>
// Test actual PostgreSQL RLS, trigger execution, roles, and rollback in an isolated database.
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const admin = '00000000-0000-0000-0000-000000000001';
const user = '00000000-0000-0000-0000-000000000002';

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE supabase_auth_admin;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE TABLE auth.audit_log_entries (
        id uuid PRIMARY KEY, payload json, created_at timestamptz, ip_address varchar(64)
      );
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, supabase_auth_admin;
      GRANT INSERT ON auth.audit_log_entries TO supabase_auth_admin;
      INSERT INTO auth.users VALUES ('${admin}'), ('${user}');
    `);
    await db.exec(fs.readFileSync(path.join(root, 'supabase_schema.sql'), 'utf8'));
    await db.exec(`INSERT INTO public.survey_admins VALUES ('${admin}');
      INSERT INTO public.admin_logs (id, status, ip_address, user_agent)
        VALUES (100000, 'SUCCESS', '198.51.100.100', 'untrusted old client');`);
    async function asUser(role, subject, operation, commit = false) {
      await db.exec('BEGIN');
      try {
        await db.exec(`SET LOCAL ROLE ${role}`);
        await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [subject]);
        const result = await operation();
        await db.exec(commit ? 'COMMIT' : 'ROLLBACK');
        return result;
      } catch (error) { await db.exec('ROLLBACK'); throw error; }
    }
    const queryAs = (role, subject, sql) => asUser(role, subject, () => db.query(sql));
    const sourceEvent = async (payload, overrides = {}, commit = true) => {
      const event = { id: randomUUID(), time: '2026-10-17T05:00:00Z', ip: '203.0.113.10', ...overrides };
      await asUser('supabase_auth_admin', '', () => db.query(
        'INSERT INTO auth.audit_log_entries (id, payload, created_at, ip_address) VALUES ($1, $2::json, $3, $4)',
        [event.id, JSON.stringify(payload), event.time, event.ip]), commit);
      return event;
    };
    const login = (actor = admin) => ({ action: 'login', log_type: 'account', actor_id: actor });

    async function verify() {
      await assert.rejects(queryAs('anon', '', 'SELECT * FROM public.admin_logs'), /permission denied/);
      assert.equal((await queryAs('authenticated', user, 'SELECT * FROM public.admin_logs')).rows.length, 0);
      assert.ok((await queryAs('authenticated', admin, 'SELECT * FROM public.admin_logs')).rows.length > 0);
      for (const [role, subject] of [['anon', ''], ['authenticated', user], ['authenticated', admin]]) {
        await assert.rejects(queryAs(role, subject,
          "INSERT INTO public.admin_logs (status) VALUES ('SUCCESS')"), /permission denied|row-level security/);
        await assert.rejects(queryAs(role, subject, 'TRUNCATE public.admin_logs'), /permission denied/);
        await assert.rejects(queryAs(role, subject, "SELECT public.verify_admin_password('admin123', 'forged')"), /permission denied/);
        await assert.rejects(queryAs(role, subject, 'SELECT public.capture_admin_auth_login()'), /permission denied/);
        await assert.rejects(queryAs(role, subject,
          `INSERT INTO auth.audit_log_entries (id, payload, created_at) VALUES ('${randomUUID()}', '{"action":"login"}', now())`), /permission denied/);
      }
    }
    await verify(); // New-project schema already protects logs.

    await db.exec(`
      -- Old policies, sequence access, and column grants must not bypass migration.
      CREATE POLICY "Allow public insert on admin_logs" ON public.admin_logs FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public select on admin_logs" ON public.admin_logs FOR SELECT USING (true);
      CREATE POLICY legacy_all ON public.admin_logs FOR ALL USING (true) WITH CHECK (true);
      GRANT ALL ON public.admin_logs TO PUBLIC, anon, authenticated;
      GRANT SELECT (ip_address), INSERT (status), UPDATE (status) ON public.admin_logs TO anon, authenticated;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION public.verify_admin_password(text,text) TO PUBLIC, anon, authenticated;
      GRANT ALL ON auth.audit_log_entries TO anon, authenticated;
      GRANT INSERT (id, payload, created_at), UPDATE (payload) ON auth.audit_log_entries TO anon, authenticated;
    `);
    const migration = fs.readFileSync(path.join(root, 'migrations/004_trusted_admin_logs.sql'), 'utf8');
    await db.exec(migration); await db.exec(migration);
    await verify();
    await db.exec('GRANT SELECT ON public.admin_logs TO anon');
    assert.equal((await queryAs('anon', '', 'SELECT ip_address FROM public.admin_logs')).rows.length, 0);
    for (const [role, subject] of [['anon', ''], ['authenticated', user], ['authenticated', admin]]) {
      // Grant only for testing restrictive policies against unexpected legacy permissions.
      await db.exec(`GRANT UPDATE, DELETE ON public.admin_logs TO ${role}`);
      assert.equal((await queryAs(role, subject, "UPDATE public.admin_logs SET status = 'FORGED' RETURNING id")).rows.length, 0);
      assert.equal((await queryAs(role, subject, 'DELETE FROM public.admin_logs RETURNING id')).rows.length, 0);
    }
    assert.equal((await db.query('SELECT event_source FROM public.admin_logs')).rows[0].event_source, 'legacy_unverified');
    const event = await sourceEvent({ ...login(), status: 'FAILED', user_agent: 'spoof',
      actor_name: 'untrusted metadata', traits: { status: 'FAILED', user_agent: 'spoof' } });
    const log = (await db.query('SELECT * FROM public.admin_logs WHERE auth_event_id = $1', [event.id])).rows[0];
    assert.equal(log.status, 'SUCCESS');
    assert.ok(log.id > 100000);
    assert.equal(log.actor_user_id, admin);
    assert.equal(log.event_source, 'supabase_auth');
    assert.equal(log.ip_address, event.ip);
    assert.equal(log.user_agent, null);
    assert.equal(new Date(log.login_time).toISOString(), new Date(event.time).toISOString());
    // No duplicates after trigger recreation/migration or replay of the source identifier.
    await db.exec(migration);
    await db.query('UPDATE auth.audit_log_entries SET id = $1 WHERE id = $2', [randomUUID(), event.id]);
    await sourceEvent(login(), { id: event.id });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.admin_logs WHERE auth_event_id = $1', [event.id])).rows[0].n, 1);
    const before = (await db.query('SELECT count(*)::int AS n FROM public.admin_logs')).rows[0].n;
    for (const payload of [login(user), { ...login(), action: 'token_refreshed' },
      { ...login(), log_type: 'user' }, { ...login(), actor_id: 'invalid' }, {}, null]) {
      await sourceEvent(payload);
    }
    await sourceEvent(login(), {}, false); // Rolled-back Auth transaction leaves no log.
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.admin_logs')).rows[0].n, before);
    const emptyIp = await sourceEvent(login(), { ip: '' });
    assert.equal((await db.query('SELECT ip_address FROM public.admin_logs WHERE auth_event_id = $1', [emptyIp.id])).rows[0].ip_address, null);
    await db.exec(`DELETE FROM public.survey_admins WHERE user_id = '${admin}'`);
    await sourceEvent(login());
    assert.equal((await queryAs('authenticated', admin, 'SELECT * FROM public.admin_logs')).rows.length, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.admin_logs')).rows[0].n, before + 1);
    console.log('PASS: admin-only reads, all client writes blocked, source/legacy-RPC forgery blocked, Auth-triggered events, ignored spoofed metadata, legacy labels, transaction rollback, event deduplication, role revocation and repeatable migration.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

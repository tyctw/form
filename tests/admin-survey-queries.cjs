// node tests/admin-survey-queries.cjs <path to @electric-sql/pglite>
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const admin = '00000000-0000-0000-0000-000000000001';
const ordinary = '00000000-0000-0000-0000-000000000002';
async function main() {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE auth.audit_log_entries(id uuid PRIMARY KEY,payload json,created_at timestamptz,ip_address varchar(64));
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
      INSERT INTO auth.users VALUES ('${admin}'),('${ordinary}');`);
    await db.exec(fs.readFileSync(path.join(root, 'supabase_schema.sql'), 'utf8'));
    const migration = fs.readFileSync(path.join(root, 'migrations/005_admin_survey_queries.sql'), 'utf8');
    // Exercise upgrading an existing schema with no query RPCs, then reapplying.
    await db.exec(`DROP FUNCTION public.admin_survey_export(jsonb,text,text,bigint,bigint,bigint);
      DROP FUNCTION public.admin_survey_stats(jsonb);
      DROP FUNCTION public.admin_survey_page(jsonb,text,integer,integer,text,boolean);
      DROP FUNCTION public.admin_filtered_surveys(jsonb);`);
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`INSERT INTO public.survey_admins VALUES ('${admin}');
      INSERT INTO public.survey_responses_full(timestamp,region,"examYear",identity,email,"chineseScore","mathScore","englishScore","socialScore","scienceScore",custom_answers)
      SELECT '2026-01-01 16:00:00+00','基北區','115','學生','row'||n||'@example.invalid','A','A','A','A','A','{"q":"literal %_ keyword"}' FROM generate_series(1,1105) n;
      INSERT INTO public.survey_responses_skip_ranking(timestamp,region,"examYear",identity,email,"chineseScore")
      SELECT '2025-01-02 02:00:00+00','桃聯區','114','家長','skip'||n||'@example.invalid','A' FROM generate_series(1,7) n;
      INSERT INTO public.survey_responses_full(timestamp,region,"examYear",identity)
      VALUES ('2026-01-01 15:59:59+00','邊界','115','老師'),
      ('2026-01-02 15:59:59.999+00','邊界','115','老師'),
      ('2026-01-02 16:00:00+00','邊界','115','老師');`);
    async function call(name, args, role = 'authenticated', uid = admin) {
      await db.exec('BEGIN');
      try {
        await db.exec(`SET LOCAL ROLE ${role}`);
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [uid]);
        const result = await db.query(`SELECT public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS result`, args);
        return result.rows[0].result;
      } finally { await db.exec('ROLLBACK'); }
    }
    const page = (filters = {}, kind = 'all', offset = 0, size = 10, sort = 'timestamp', asc = false, role, uid) =>
      call('admin_survey_page', [JSON.stringify(filters),kind,offset,size,sort,asc],role,uid);
    const stats = filters => call('admin_survey_stats', [JSON.stringify(filters || {})]);
    const exportPage = (filters = {}, kind = 'all', source = '', id = 0, fullMax = null, skipMax = null, role, uid) =>
      call('admin_survey_export', [JSON.stringify(filters),kind,source,id,fullMax,skipMax],role,uid);
    for (const [name, args] of [
      ['admin_filtered_surveys',['{}']], ['admin_survey_stats',['{}']],
      ['admin_survey_page',['{}','all',0,10,'timestamp',false]],
      ['admin_survey_export',['{}','all','',0,null,null]],
    ]) {
      await assert.rejects(call(name,args,'anon',''),/permission denied/);
      await assert.rejects(call(name,args,'authenticated',ordinary),/Admin required/);
    }
    const allStats = await stats();
    assert.equal(allStats.total,1115);
    assert.equal(allStats.full,1108);
    assert.equal(allStats.skip,7);
    assert.deepEqual(allStats.years,['115','114']);
    assert.equal(allStats.days.find(x=>x.date==='2025-01-02').count,7);
    assert.equal(allStats.days.find(x=>x.date==='2026-01-02').count,1106);
    assert.equal(allStats.scores.find(x=>x.name==='未完整填寫').count,10);
    assert.equal(allStats.scores.find(x=>x.name==='25-29 積分').count,1105);
    assert.equal(JSON.stringify(allStats).includes('@example.invalid'),false);
    const filter = {examYear:'115',region:'基北區',identity:'學生',startDate:'2026-01-02',endDate:'2026-01-02',ranking:'full',search:'literal %_'};
    const summary = await stats(filter);
    assert.equal(summary.total,1105);
    assert.equal(summary.skip,0);
    assert.equal((await page(filter,'skip')).total,0);
    assert.equal((await stats({...filter,identity:'家長'})).total,0);
    assert.equal((await stats({...filter,search:"' OR true --"})).total,0);
    const boundary = await page({region:'邊界',startDate:'2026-01-02',endDate:'2026-01-02'});
    assert.equal(boundary.total,1);
    assert.equal(boundary.rows[0].timestamp,'2026-01-02T15:59:59.999+00:00');
    const first = await page(filter,'full',0,100);
    const second = await page(filter,'full',100,100);
    assert.equal(first.rows.length,100);
    assert.equal(first.total,summary.total);
    assert.equal(new Set([...first.rows,...second.rows].map(r=>r.id)).size,200);
    assert.deepEqual((await page(filter,'full',0,100)).rows,first.rows);
    assert.equal((await page(filter,'full',2000,50)).rows.length,0);
    assert.equal((await page({},'all',0,10,'examYear',true)).rows[0].examYear,'114');
    assert.equal((await page({},'all',0,10,'totalScore',false)).rows[0].chineseScore,'A');
    await assert.rejects(page({},'all',0,501),/Invalid pagination/);
    await assert.rejects(page({},'all',-1),/Invalid pagination/);
    await assert.rejects(page({},'all',0,10,'id; DROP TABLE'),/Invalid pagination/);
    await assert.rejects(stats({startDate:'2026-02-01',endDate:'2026-01-01'}),/開始日期/);
    await assert.rejects(stats({ranking:'unsafe'}),/Invalid filters/);
    const exported=[];
    let batch = await exportPage(filter);
    const fullMax=batch.fullMax, skipMax=batch.skipMax;
    assert.equal(batch.rows.length,500);
    await db.exec(`INSERT INTO public.survey_responses_full(timestamp,region,"examYear",identity,custom_answers)
      VALUES ('2026-01-02 01:00:00+00','基北區','115','學生','{"q":"literal %_ keyword"}');`);
    while (batch.rows.length) {
      exported.push(...batch.rows);
      const last=batch.rows.at(-1);
      batch=await exportPage(filter,'all',last._source,last.id,fullMax,skipMax);
    }
    assert.equal(exported.length,1105);
    assert.equal(new Set(exported.map(r=>`${r._source}:${r.id}`)).size,1105);
    const both=[];
    batch=await exportPage();
    const bounds=[batch.fullMax,batch.skipMax];
    while(batch.rows.length){
      both.push(...batch.rows);
      const last=batch.rows.at(-1);
      batch=await exportPage({},'all',last._source,last.id,...bounds);
    }
    assert.equal(both.length,1116);
    assert.equal(both.filter(x=>x._source==='skip').length,7);
    assert.equal(new Set(both.map(r=>`${r._source}:${r.id}`)).size,1116);
    await db.exec(`DELETE FROM public.survey_admins WHERE user_id='${admin}';`);
    await assert.rejects(stats(),/Admin required/);
    await assert.rejects(page(),/Admin required/);
    await assert.rejects(exportPage(),/Admin required/);
    console.log('PASS: admin authorization, RLS, combined filters, literal search, Taipei boundaries, full-year trends, complete-score groups, stable bounded pages, sorting, export across >1000 rows and both tables, concurrent-insert fences, immediate revocation and repeatable migration.');
  } finally { await db.close(); }
}
main().catch(error=>{ console.error(error); process.exitCode=1; });

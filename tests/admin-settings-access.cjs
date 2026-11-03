// node tests/admin-settings-access.cjs <path to @electric-sql/pglite>
const {PGlite}=require(process.argv[2]||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const admin='00000000-0000-0000-0000-000000000001', user='00000000-0000-0000-0000-000000000002';
const root=path.resolve(__dirname,'..');
const payload={announcement_date:'2026-11-03T04:00:00Z',announcement_content:{title:'新公告',body:'說明',linkLabel:'查詢',linkUrl:'https://example.invalid'},custom_questions:[],subject_score_start_time:null,subject_score_end_time:null,subject_score_enabled:true,system_start_time:null,system_end_time:null,system_enabled:true};
async function main(){const db=new PGlite();try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE auth.audit_log_entries(id uuid PRIMARY KEY,payload json,created_at timestamptz,ip_address varchar(64));
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;INSERT INTO auth.users VALUES('${admin}'),('${user}');`);
  await db.exec(fs.readFileSync(path.join(root,'supabase_schema.sql'),'utf8').split('\n-- Admin settings versioning; matches migration 006.')[0]);
  const migration=fs.readFileSync(path.join(root,'migrations/006_admin_settings_dashboard.sql'),'utf8');
  await db.exec(migration);await db.exec(migration);
  await db.exec(`INSERT INTO public.survey_admins VALUES('${admin}');`);
  async function call(name,args,role='authenticated',uid=admin){
    await db.exec('BEGIN');try{await db.exec(`SET LOCAL ROLE ${role}`);await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);
      const result=await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args);
      // Commit so successive requests observe saved settings. Failed calls roll back below.
      await db.exec('COMMIT');return result.rows[0].result;
    }catch(e){await db.exec('ROLLBACK');throw e;}
  }
  const publish=(id,rev,settings=payload,role,uid)=>call('publish_survey_config',[id,rev,JSON.stringify(settings)],role,uid);
  await assert.rejects(publish(1,0,payload,'anon',''),/permission denied/);
  await assert.rejects(publish(1,0,payload,'authenticated',user),/Admin required/);
  let saved=await publish(1,0);
  assert.equal(saved.status,'saved');assert.equal(saved.current.revision,1);
  const stale=await publish(1,0,{...payload,system_enabled:false});
  assert.equal(stale.status,'conflict');assert.equal(stale.current.system_enabled,true);
  assert.equal(stale.current.announcement_content.title,'新公告');
  saved=await publish(1,1,{...payload,system_enabled:false});assert.equal(saved.current.revision,2);
  assert.equal((await publish(999,2)).status,'conflict');
  await assert.rejects(publish(1,2,{...payload,system_start_time:'2026-11-04T00:00:00Z',system_end_time:'2026-11-03T00:00:00Z'}),/開始時間/);
  await assert.rejects(publish(1,2,{...payload,system_end_time:'2026-11-03T00:00:00Z',subject_score_start_time:'2026-11-04T00:00:00Z'}),/沒有交集/);
  await assert.rejects(publish(1,2,{...payload,custom_questions:[{id:'q',question:'題目',type:'radio',options:['甲','甲']}]}),/選項/);
  await assert.rejects(publish(1,2,{...payload,custom_questions:[{id:'__SYSTEM_BACKUPS__',question:'伪造',type:'text'}]}),/識別碼/);
  await assert.rejects(publish(1,2,{...payload,announcement_content:{linkUrl:'javascript:alert(1)'}}),/公告/);
  await assert.rejects(publish(1,2,{...payload,custom_questions:[{id:'q',question:'題目',type:'text',startTime:'2026-11-04T00:00'}],system_end_time:'2026-11-03T00:00:00Z'}),/題目時間/);
  // Direct privileged maintenance must advance the version, ignoring any supplied revision.
  await db.exec('UPDATE public.survey_config SET revision=-500,system_enabled=true WHERE id=1');
  assert.equal((await publish(1,2)).status,'conflict');
  assert.equal((await db.query('SELECT revision FROM public.survey_config')).rows[0].revision,3);
  for(let rev=3;rev<6;rev++)await publish(1,rev,{...payload,announcement_content:{...payload.announcement_content,title:'版本'+rev}});
  const config=(await db.query('SELECT * FROM public.survey_config WHERE id=1')).rows[0];
  assert.equal(config.custom_questions[0].id,'__SYSTEM_BACKUPS__');
  assert.equal(config.custom_questions[0].data.length,3);
  assert.equal(config.custom_questions[0].data[0].announcement_content.title,'版本5');
  await db.exec(`TRUNCATE public.survey_config;`);
  saved=await publish(null,null);assert.equal(saved.status,'saved');assert.equal(saved.current.revision,1);
  assert.equal((await publish(null,null)).status,'conflict');
  await db.exec(`INSERT INTO public.survey_responses_full(timestamp,region,"examYear",email,"chineseScore","mathScore","englishScore","socialScore","scienceScore","minRatio","maxRatio","minRankInterval","maxRankInterval")
    VALUES(now(),'基北區','115','private@example.invalid','A','A','A','A','A',0,2,1,100),
      (now(),'基北區','115','other@example.invalid','A','A','A','A','A',2,1,1,100);
    INSERT INTO public.survey_responses_skip_ranking(timestamp,region,"examYear","chineseScore","mathScore","englishScore","socialScore","scienceScore")
    VALUES(now()-interval '1 day','桃聯區','114','B','B','B','B','B'),(now()-interval '2 days','桃聯區','114','A',NULL,NULL,NULL,NULL);`);
  const stats=await call('admin_survey_stats',['{}']);
  assert.equal(stats.total,4);assert.equal(stats.valid,2);assert.equal(stats.today,2);assert.equal(stats.recentDays.length,7);
  assert.equal(stats.recentDays.reduce((sum,x)=>sum+x.count,0),4);assert.equal(stats.recentDays[0].count,0);
  assert.equal(stats.formStatus.state,'open');
  for(const [settings,state] of [[{system_enabled:false},'closed'],[{system_start_time:'2999-01-01T00:00:00Z'},'scheduled'],[{system_end_time:'2000-01-01T00:00:00Z'},'ended']]){
    await db.exec(`UPDATE public.survey_config SET system_enabled=true,system_start_time=NULL,system_end_time=NULL`);
    const [key,value]=Object.entries(settings)[0];await db.query(`UPDATE public.survey_config SET ${key}=$1`,[value]);
    assert.equal((await call('admin_survey_stats',['{}'])).formStatus.state,state);
  }
  const args=['{}','all','',0,null,null,['email','region'],false];
  let exp=await call('admin_survey_export_selected',args);
  assert.equal(exp.rows[0].email,'***@***');assert.equal('chineseScore' in exp.rows[0],false);
  assert.equal(JSON.stringify(exp).includes('private@example.invalid'),false);
  exp=await call('admin_survey_export_selected',[...args.slice(0,-1),true]);
  assert.equal(exp.rows[0].email,'private@example.invalid');
  await assert.rejects(call('admin_survey_export_selected',args,'anon',''),/permission denied/);
  await assert.rejects(call('admin_survey_export_selected',args,'authenticated',user),/Admin required/);
  await assert.rejects(call('admin_survey_export_selected',[...args.slice(0,6),[],false]),/欄位/);
  await assert.rejects(call('admin_survey_export_selected',[...args.slice(0,6),['password'],true]),/欄位/);
  const latest=(await db.query('SELECT id,revision FROM public.survey_config ORDER BY id LIMIT 1')).rows[0];
  await db.exec('CREATE POLICY block_publish_test ON public.survey_config AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false)');
  assert.equal((await publish(latest.id,latest.revision)).status,'conflict');
  await db.exec('DROP POLICY block_publish_test ON public.survey_config');
  await db.exec(`DELETE FROM public.survey_admins WHERE user_id='${admin}'`);
  await assert.rejects(publish(saved.current.id,1),/Admin required/);
  await assert.rejects(call('admin_survey_export_selected',args),/Admin required/);
  console.log('PASS: atomic revision comparison, stale/empty-table conflict, role protection, trusted revisions, schedule validation, server backups, dashboard validity/time windows, selected/masked exports and revocation.');
}finally{await db.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});

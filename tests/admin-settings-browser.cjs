// All external requests mocked. Requires Vite using https://admin-test.supabase.co.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.APP_URL||'http://127.0.0.1:4175/form/';
let live={id:1,revision:0,announcement_date:'2026-11-03T04:00:00Z',announcement_content:{title:'初始標題',body:'原說明',linkLabel:'查詢',linkUrl:'https://example.invalid'},custom_questions:[],system_enabled:true,subject_score_enabled:true,system_start_time:null,system_end_time:null,subject_score_start_time:null,subject_score_end_time:null};
const calls=[],errors=[];
let raceOnPublish=false;
async function main(){
  const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:1000},timezoneId:'America/Los_Angeles',acceptDownloads:true});
  const handler=async route=>{
    const req=route.request(),url=new URL(req.url()),body=req.postDataJSON()||{};
    if(url.hostname!=='admin-test.supabase.co')return route.abort();
    calls.push({path:url.pathname,body});
    const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if(url.pathname==='/auth/v1/token')return json({access_token:'fake-token',refresh_token:'fake-refresh',expires_in:3600,token_type:'bearer',user:{id:'00000000-0000-0000-0000-000000000001',email:'admin@example.invalid',aud:'authenticated'}});
    if(url.pathname==='/auth/v1/logout')return json({});
    if(url.pathname==='/rest/v1/rpc/is_admin')return json(true);
    if(url.pathname==='/rest/v1/admin_logs')return json([]);
    if(url.pathname==='/rest/v1/survey_config')return json(live?[live]:[]);
    if(url.pathname==='/rest/v1/rpc/admin_survey_stats')return json({total:3,full:2,skip:1,today:2,valid:2,regions:[{name:'基北區',count:2},{name:'桃聯區',count:1}],identities:[],scores:[],days:[],years:['115'],regionOptions:['基北區','桃聯區'],identityOptions:['學生'],recentDays:Array.from({length:7},(_,i)=>({date:`2026-11-${String(i+1).padStart(2,'0')}`,count:i===6?2:0})),formStatus:{state:'open',start:null,end:null}});
    if(url.pathname==='/rest/v1/rpc/publish_survey_config'){
      if(!live){live={id:1,revision:1,...body.p_settings};return json({status:'saved',current:live});}
      if(raceOnPublish){raceOnPublish=false;live={...live,revision:live.revision+1,announcement_content:{...live.announcement_content,title:'確認後另一人發布'}};}
      if(body.p_id!==live.id||body.p_revision!==live.revision)return json({status:'conflict',current:live});
      live={...live,...body.p_settings,revision:live.revision+1};return json({status:'saved',current:live});
    }
    if(url.pathname==='/rest/v1/rpc/admin_survey_export_selected'){
      const row={id:1,_source:'full',region:'基北區',email:body.p_include_personal?'private@example.invalid':'***@***',minRatio:0};
      return json({fullMax:1,skipMax:0,rows:body.p_after_source?[]:[Object.fromEntries(Object.entries(row).filter(([key])=>['id','_source',...body.p_fields].includes(key)))]});
    }
    throw new Error('Unexpected request '+url.pathname);
  };
  await context.route('https://**/*',handler);
  const pages=[];
  const page=await context.newPage();pages.push(page);page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const button=(p,name)=>p.getByRole('button',{name,exact:true});
  async function login(p){
    await p.goto(base+'#/guide');
    await p.getByRole('link',{name:'返回首頁',exact:true}).click();
    await p.goto(base+'#/admin');
    const input=p.getByPlaceholder('管理員 Email');
    if(await input.isVisible()){
      await input.fill('admin@example.invalid');await p.getByPlaceholder('管理員密碼').fill('fixture-password-123');await button(p,'登入系統').click();
    }
    await p.getByText('符合條件 3 筆',{exact:true}).waitFor();
  }
  try{
    await login(page);
    await page.getByText('開放填寫',{exact:true}).waitFor();
    await page.getByText('有效樣本',{exact:true}).waitFor();
    await page.getByRole('heading',{name:'近七日填寫趨勢'}).waitFor();
    assert.ok((await page.getByLabel('各區樣本數').innerText()).includes('基北區：2 筆'));
    const secondContext=await browser.newContext({viewport:{width:1366,height:1000},timezoneId:'America/Los_Angeles'});await secondContext.route('https://**/*',handler);const second=await secondContext.newPage();pages.push(second);second.setDefaultTimeout(10000);second.on('pageerror',e=>errors.push(e.message));await login(second);
    await button(page,'系統設定與自訂問卷').click();
    await page.getByLabel('公告標題',{exact:true}).fill('第一位更新');
    await page.getByText(/項未儲存變更/).waitFor();
    await button(page,'分析圖表').click();
    await button(page,'系統設定與自訂問卷').click();
    assert.equal(await page.getByLabel('公告標題',{exact:true}).inputValue(),'第一位更新');
    const dismissed=page.waitForEvent('dialog').then(dialog=>dialog.dismiss());
    await button(page,'登出系統').click();await dismissed;
    await page.getByRole('heading',{name:'管理員分析看板'}).waitFor();
    await page.getByLabel('表單開始時間',{exact:true}).fill('2026-11-03T12:00');
    await page.getByLabel('表單結束時間',{exact:true}).fill('2026-11-03T10:00');
    await page.getByText('表單開始時間必須早於結束時間',{exact:true}).waitFor();
    assert.equal(await button(page,'儲存所有設定').isDisabled(),true);
    await page.getByLabel('表單結束時間',{exact:true}).fill('2026-11-03T15:00');
    await button(page,'儲存所有設定').click();
    const dialog=page.getByRole('dialog',{name:'發布前設定比較'});await dialog.waitFor();
    assert.ok((await dialog.innerText()).includes('初始標題'));assert.ok((await dialog.innerText()).includes('第一位更新'));
    await button(page,'確認發佈').click();
    await page.getByText('設定已成功發布。',{exact:true}).waitFor();
    assert.equal(await page.getByText(/項未儲存變更/).count(),0);
    assert.equal(live.system_start_time,'2026-11-03T04:00:00.000Z'); // Browser is in Los Angeles; input is Taipei.
    await button(second,'系統設定與自訂問卷').click();
    await second.getByLabel('公告標題',{exact:true}).fill('第二位草稿');
    await button(second,'儲存所有設定').click();
    await second.getByText('線上版本已更新，這次發布已被擋下，您的草稿仍保留。',{exact:true}).waitFor();
    assert.equal(await button(second,'確認發佈').isDisabled(),true);
    assert.equal(live.announcement_content.title,'第一位更新');
    await button(second,'保留草稿，以最新版重新比較').click();
    const secondDialog=second.getByRole('dialog',{name:'發布前設定比較'});
    assert.ok((await secondDialog.innerText()).includes('第一位更新'));assert.ok((await secondDialog.innerText()).includes('第二位草稿'));
    raceOnPublish=true;
    await button(second,'確認發佈').click();
    await second.getByText('線上版本已更新，這次發布已被擋下，您的草稿仍保留。',{exact:true}).waitFor();
    assert.equal(live.announcement_content.title,'確認後另一人發布');
    await button(second,'保留草稿，以最新版重新比較').click();
    await button(second,'確認發佈').click();
    await second.getByText('設定已成功發布。',{exact:true}).waitFor();
    assert.equal(live.announcement_content.title,'第二位草稿');
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('button',{name:'比較最新版本'}).waitFor();
    await page.getByRole('button',{name:'比較最新版本'}).click();
    const accept=page.waitForEvent('dialog').then(d=>d.accept());
    await button(page,'捨棄草稿並載入線上版本').click();await accept;
    assert.equal(await page.getByLabel('公告標題',{exact:true}).inputValue(),'第二位草稿');
    await button(page,'匯出 CSV').click();
    assert.equal(await page.getByLabel('包含完整 Email（個資）').isChecked(),false);
    await button(page,'清除欄位').click();
    await page.getByText('請至少選擇一個匯出欄位。',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:/全部資料.*3 筆/}).isDisabled(),true);
    await page.getByLabel('Email',{exact:true}).check();
    let downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:/全部資料.*3 筆/}).click();
    let download=await downloadPromise,csv=fs.readFileSync(await download.path(),'utf8');
    assert.equal(csv.trim(),'"Email"\n"***@***"');
    await button(page,'匯出 CSV').click();
    await page.getByLabel('包含完整 Email（個資）').check();
    downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/全部資料.*3 筆/}).click();
    download=await downloadPromise;csv=fs.readFileSync(await download.path(),'utf8');
    assert.ok(csv.includes('private@example.invalid'));
    await button(page,'匯出 CSV').click();assert.equal(await page.getByLabel('包含完整 Email（個資）').isChecked(),false);
    await button(page,'關閉匯出選單').click();
    // Create router-owned history, then verify both forward navigation and a Link are blocked.
    await page.getByRole('link',{name:'返回首頁',exact:true}).click();
    await page.getByRole('heading',{name:'會考序位調查問卷'}).waitFor();
    await page.goBack();
    await page.getByRole('heading',{name:'管理員分析看板'}).waitFor();
    await button(page,'系統設定與自訂問卷').click();
    await page.getByLabel('公告標題',{exact:true}).fill('保留未發布');
    await page.getByText(/項未儲存變更/).waitFor();
    const cancelNavigation=page.waitForEvent('dialog').then(d=>d.dismiss());
    await page.evaluate(()=>history.forward());await cancelNavigation;
    await page.getByRole('heading',{name:'管理員分析看板'}).waitFor();assert.ok(page.url().endsWith('#/admin'));
    const cancelLink=page.waitForEvent('dialog').then(d=>d.dismiss());
    await page.getByRole('link',{name:'返回首頁',exact:true}).click();await cancelLink;
    assert.ok(page.url().endsWith('#/admin'));
    await button(page,'儲存所有設定').click();
    await page.getByRole('dialog',{name:'發布前設定比較'}).waitFor();
    await page.screenshot({path:'/tmp/admin-settings-diff.png'});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:'/tmp/admin-settings-diff-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1366,height:1000});
    await button(page,'返回編輯').click();
    const leave=page.waitForEvent('dialog').then(d=>d.accept());
    await button(page,'登出系統').click();await leave;
    await page.getByRole('heading',{name:'系統管理員登入'}).waitFor();
    live=null;
    await login(page);
    await button(page,'系統設定與自訂問卷').click();
    await button(page,'儲存所有設定').click();
    await page.getByText('設定建立',{exact:true}).waitFor();
    await button(page,'確認發佈').click();
    await page.getByText('設定已成功發布。',{exact:true}).waitFor();
    assert.equal(live.revision,1);
    assert.deepEqual(errors,[]);
    console.log('PASS: dashboard, unsaved draft preservation/logout/navigation guard, Taipei inputs, time validation, publish diff, two-admin stale/race protection, explicit rebase/discard, selected export/default mask/opt-in/reset.');
  }catch(err){for(const p of pages)console.error((await p.locator('body').innerText()).slice(-5000));throw err;}
  finally{await browser.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});

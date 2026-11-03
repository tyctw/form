// Start Vite with VITE_SUPABASE_URL=https://admin-test.supabase.co and a fake public key.
// No live services are accessed: all external HTTP requests are intercepted.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.APP_URL || 'http://127.0.0.1:4175/form/';
const browserPath = process.env.BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fixture = Array.from({length:31},(_,i)=>({
  id:i+1,_source:i<26?'full':'skip',timestamp:'2026-11-03T02:00:00+00:00',
  region:'基北區',examYear:i<26?'115':'114',identity:i<26?'學生':'家長',
  chineseScore:'A',mathScore:'A',englishScore:'A',socialScore:'A',scienceScore:'A',essayScore:'6',
  email:`row${i+1}@example.invalid`,minRatio:0,maxRatio:2,minRankInterval:1,maxRankInterval:100,
  custom_answers:{q:`=1+${i}`},
}));
function filtered(filters,kind='all') {
  return fixture.filter(r=>(kind==='all'||r._source===kind)
    && (!filters.ranking||filters.ranking==='all'||filters.ranking===r._source)
    && ['examYear','region','identity'].every(k=>!filters[k]||filters[k]===r[k])
    && (!filters.search||JSON.stringify(r).includes(filters.search)));
}
function summary(filters) {
  const rows=filtered(filters);
  return {total:rows.length,full:rows.filter(r=>r._source==='full').length,
    skip:rows.filter(r=>r._source==='skip').length,today:rows.length,
    regions:rows.length?[{name:'基北區',count:rows.length}]:[],
    identities:rows.length?[{name:'學生',count:rows.length}]:[],
    scores:rows.length?[{name:'25-29 積分',count:rows.length}]:[],
    days:rows.length?[{date:'2026-11-03',count:rows.length}]:[],
    years:['115','114'],regionOptions:['基北區','桃聯區'],identityOptions:['學生','家長']};
}
async function main(){
  const browser=await chromium.launch({executablePath:browserPath,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
  page.setDefaultTimeout(10000);
  const calls=[], errors=[];
  let delayNextPage=false,failPage=false,failStats=false,failExport=false;
  page.on('pageerror',err=>errors.push(err.message));
  await page.route('https://**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname!=='admin-test.supabase.co')return route.abort();
    const body=req.postDataJSON()||{};
    calls.push({path:url.pathname,body});
    const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname==='/auth/v1/token'){
      const user={id:'00000000-0000-0000-0000-000000000001',email:'admin@example.invalid',aud:'authenticated'};
      return json({access_token:'fake-access-token',refresh_token:'fake-refresh-token',token_type:'bearer',expires_in:3600,user});
    }
    if(url.pathname==='/auth/v1/logout')return json({});
    if(url.pathname==='/rest/v1/rpc/is_admin')return json(true);
    if(url.pathname==='/rest/v1/admin_logs')return json([]);
    if(url.pathname==='/rest/v1/survey_config')return json([{id:1,custom_questions:[],system_enabled:true,revision:0}]);
    if(url.pathname==='/rest/v1/rpc/admin_survey_stats')return failStats?json({message:'test failure'},500):json(summary(body.p_filters));
    if(url.pathname==='/rest/v1/rpc/admin_survey_page'){
      if(delayNextPage){delayNextPage=false;await new Promise(resolve=>setTimeout(resolve,500));}
      if(failPage)return json({message:'test failure'},500);
      let rows=filtered(body.p_filters,body.p_kind);
      if(body.p_ascending)rows=[...rows].reverse();
      return json({total:rows.length,rows:rows.slice(body.p_offset,body.p_offset+body.p_limit)});
    }
    if(url.pathname==='/rest/v1/rpc/admin_survey_export_selected')return failExport?json({message:'test failure'},500):json({fullMax:26,skipMax:31,rows:body.p_after_source?[]:filtered(body.p_filters,body.p_kind).map(row=>({...row,email:body.p_include_personal?row.email:'***@***'}))});
    throw new Error('Unexpected external call: '+url.pathname);
  });
  const tab = name=>page.getByRole('button',{name,exact:true});
  try{
    await page.goto(base+'#/admin');
    await page.getByPlaceholder('管理員 Email').fill('admin@example.invalid');
    await page.getByPlaceholder('管理員密碼').fill('fixture-password-123');
    await tab('登入系統').click();
    await page.getByText('符合條件 31 筆',{exact:true}).waitFor();
    assert.equal(calls.some(c=>c.path.includes('survey_responses')),false);
    assert.equal(calls.some(c=>c.path.endsWith('admin_survey_page')),false);
    await tab('完整填寫資料').click();
    await page.getByText('顯示 1 到 10 筆，共 26 筆').waitFor();
    assert.equal(await page.locator('tbody tr').count(),10);
    await tab('完整填寫資料').click(); // Same-tab click must retain existing rows.
    assert.equal(await page.locator('tbody tr').count(),10);
    await tab('下一頁').click();
    await page.getByText('顯示 11 到 20 筆，共 26 筆').waitFor();
    assert.equal(calls.filter(c=>c.path.endsWith('admin_survey_page')).at(-1).body.p_offset,10);
    await page.getByRole('columnheader',{name:/會考年度/}).click();
    await page.getByText('顯示 1 到 10 筆，共 26 筆').waitFor();
    assert.equal(calls.filter(c=>c.path.endsWith('admin_survey_page')).at(-1).body.p_sort,'examYear');
    await page.getByLabel('會考年度',{exact:true}).selectOption('115');
    await page.getByLabel('開始日期（台北時間）').fill('2026-11-03');
    await page.getByLabel('結束日期（包含當日）').fill('2026-11-03');
    await tab('套用篩選').click();
    await page.getByText('符合條件 26 筆',{exact:true}).waitFor();
    await page.getByText('顯示 1 到 10 筆，共 26 筆').waitFor();
    const expected=calls.filter(c=>c.path.endsWith('admin_survey_stats')).at(-1).body.p_filters;
    assert.deepEqual(calls.filter(c=>c.path.endsWith('admin_survey_page')).at(-1).body.p_filters,expected);
    await tab('匯出 CSV').click();
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:/全部資料.*26 筆/}).click();
    const download=await downloadPromise;
    const csv=fs.readFileSync(await download.path(),'utf8');
    assert.equal(csv.trim().split('\n').length,27); // All filtered rows, not just the current ten.
    assert.ok(csv.includes('"0","2","1","100"')); // Preserve zero ratio in CSV.
    assert.ok(csv.includes("=1+25"));
    assert.ok(csv.includes('***@***'));
    assert.equal(csv.includes('@example.invalid'),false);
    assert.deepEqual(calls.filter(c=>c.path.endsWith('admin_survey_export_selected'))[0].body.p_filters,expected);
    const beforeInvalid=calls.length;
    await page.getByLabel('開始日期（台北時間）').fill('2026-11-04');
    await tab('套用篩選').click();
    await page.getByText('開始日期不可晚於結束日期',{exact:true}).waitFor();
    assert.equal(calls.length,beforeInvalid);
    await tab('清除篩選').click();
    await page.getByText('符合條件 31 筆',{exact:true}).waitFor();
    delayNextPage=true;
    await tab('下一頁').click();
    await page.getByLabel('會考年度',{exact:true}).selectOption('114');
    await tab('套用篩選').click();
    await page.getByText('符合條件 5 筆',{exact:true}).waitFor();
    await page.getByText('目前篩選條件沒有資料',{exact:true}).waitFor();
    await new Promise(resolve=>setTimeout(resolve,600));
    assert.equal(await page.locator('tbody tr').count(),1); // Empty-state row; old page must not win.
    await tab('無序位填寫資料').click();
    await page.getByText('顯示 1 到 5 筆，共 5 筆').waitFor();
    await page.getByLabel('序位資料').selectOption('full');
    await tab('套用篩選').click();
    await page.getByText('目前篩選條件沒有資料',{exact:true}).waitFor();
    await tab('清除篩選').click();
    await page.getByText('顯示 1 到 10 筆，共 26 筆').waitFor();
    failPage=true;
    await tab('重新載入').click();
    await page.getByText('資料載入失敗，請重試',{exact:true}).waitFor();
    assert.equal(await page.locator('tbody tr').count(),1);
    failPage=false;
    await tab('重試').click();
    await page.getByText('顯示 1 到 10 筆，共 26 筆').waitFor();
    failStats=true;
    await tab('重新載入').click();
    await page.getByText('無法載入統計，請重試或聯絡系統管理者。',{exact:false}).waitFor();
    failStats=false;
    await tab('重試').click();
    await page.getByText('符合條件 31 筆',{exact:true}).waitFor();
    failExport=true;
    await tab('匯出 CSV').click();
    await page.getByRole('button',{name:/全部資料.*31 筆/}).click();
    await page.getByText('匯出失敗，請重試；未產生不完整的下載檔案。',{exact:true}).last().waitFor();
    await page.getByRole('button',{name:'關閉匯出選單'}).click();
    failExport=false;
    await tab('重新載入').click();
    await page.getByText('顯示 1 到 10 筆，共 26 筆').waitFor();
    await page.screenshot({path:'/tmp/admin-survey-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'/tmp/admin-survey-mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:/登出/}).click();
    await page.getByRole('heading',{name:'系統管理員登入'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: login uses summary only; bounded table pages; shared filters and export; sorting/page reset; invalid dates; cancellation of stale queries; ranking intersections; empty/error/retry states; CSV all-pages/zero/formula protection; desktop/mobile layout; logout.');
  }catch(error){ console.error('Browser state:', await page.locator('body').innerText()); console.error('Calls:',calls); throw error; }finally{await browser.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});

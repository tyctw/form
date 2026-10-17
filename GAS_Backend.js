/*
 * 這是你的 Google Apps Script 完整後端程式碼。
 * 請將這段程式碼複製並貼上到 Google Apps Script 編輯器中 (取代原有的程式碼)。
 * 
 * 修改說明：
 * 1. setup 可初始化舊工作表標題；新表單提交已改存 Supabase。
 * 2. doPost 轉送至 submit_survey RPC，由資料庫檢查開放時間、欄位與提交頻率。
 * 3. 必須設定 Script Properties 的 SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY。
 * 4. 舊 doGet 仍會讀取工作表，其讀取權限風險見 SECURITY_REVIEW.md 第 4 項。
 */

const SPREADSHEET_ID = '19FHnXgYlOYbJWoRY8f-AdGBUyZkv4jyX-8_DDv_5vX4'; // 替換為你的試算表 ID
const SHEET_NAME_FULL = 'Sheet1'; // 有提供序位的資料表名稱
const SHEET_NAME_SKIP = 'Sheet2'; // 不提供序位的資料表名稱

// 與 src/utils/spreadsheet.ts 保持一致；GAS 部署需維持單檔可用。
function toSpreadsheetCell(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  const text = value == null ? '' : String(value);
  const unsafePrefix = /^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f=+\-@＝＋－＠]/u;
  return unsafePrefix.test(text) ? "'" + text : text;
}

// 所有 appendRow 都經過此邊界，避免新增欄位時漏掉公式防護。
function appendSafeRow(sheet, values) {
  sheet.appendRow(values.map(toSpreadsheetCell));
}

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 設定有提供序位的資料表
  let sheetFull = ss.getSheetByName(SHEET_NAME_FULL);
  if (!sheetFull) {
    sheetFull = ss.insertSheet(SHEET_NAME_FULL);
  }
  if (sheetFull.getLastRow() === 0) {
    appendSafeRow(sheetFull, [
      '時間戳記', '區域', '會考年度', '國文成績', '數學成績', '英文成績', '社會成績', '自然成績', '作文成績',
      '全區序位最小比率(%)', '全區序位最大比率(%)', '全區序位最小區間', '全區序位最大區間', 'email'
    ]);
  }
  
  // 設定不提供序位的資料表
  let sheetSkip = ss.getSheetByName(SHEET_NAME_SKIP);
  if (!sheetSkip) {
    sheetSkip = ss.insertSheet(SHEET_NAME_SKIP);
  }
  if (sheetSkip.getLastRow() === 0) {
    appendSafeRow(sheetSkip, [
      '時間戳記', '區域', '會考年度', '國文成績', '數學成績', '英文成績', '社會成績', '自然成績', '作文成績', 'email'
    ]);
  }
}

// 舊 GAS 入口也必須走資料庫驗證，不再直接寫入工作表。
// Script Properties 需設定 SUPABASE_URL 與 SUPABASE_PUBLISHABLE_KEY。
function doPost(e) {
  function respond(value) {
    return ContentService.createTextOutput(JSON.stringify(value))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 32768) {
      return respond({ status: 'error', message: '提交內容格式錯誤或過大' });
    }
    const data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return respond({ status: 'error', message: '提交內容格式錯誤' });
    }
    const properties = PropertiesService.getScriptProperties();
    const url = properties.getProperty('SUPABASE_URL') || '';
    const key = properties.getProperty('SUPABASE_PUBLISHABLE_KEY') || '';
    // 僅使用公開 publishable key，禁止以 service-role key 繞過用戶端權限。
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_')) {
      return respond({ status: 'error', message: '尚未設定安全提交服務，請改用網站填寫' });
    }
    const requestId = data.requestId || Utilities.getUuid();
    delete data.requestId;
    const response = UrlFetchApp.fetch(url + '/rest/v1/rpc/submit_survey', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: key },
      payload: JSON.stringify({ p_payload: data, p_request_id: requestId }),
      muteHttpExceptions: true,
      followRedirects: false,
    });
    const code = response.getResponseCode();
    const result = JSON.parse(response.getContentText());
    if (code < 200 || code >= 300) {
      return respond({ status: 'error', message: result.code === '22023'
        ? result.message : '提交服務暫時無法使用，請稍後再試' });
    }
    if (!result.inviteCode || !result.expiration) throw new Error('Invalid response');
    return respond({ status: 'success', inviteCode: result.inviteCode, expiration: result.expiration });
  } catch (error) {
    return respond({ status: 'error', message: '提交失敗，請確認資料後重試' });
  }
}
function doGet(e) {
  // 保持原有 doGet 資料讀取功能（針對主要資料表）
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME_FULL) || ss.getSheets()[0];
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j];
    }
    result.push(item);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

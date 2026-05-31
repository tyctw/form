/*
 * 這是你的 Google Apps Script 完整後端程式碼。
 * 請將這段程式碼複製並貼上到 Google Apps Script 編輯器中 (取代原有的程式碼)。
 * 
 * 修改說明：
 * 1. 新增了 SETUP 邏輯，會自動初始化有提供與不提供序位的兩個資料表 (Sheet1, Sheet2)。
 * 2. 在 doPost 裡面判斷前端傳來的 `skipRanking` 欄位：
 *    - 如果 skipRanking 為 true：傳送資料到 Sheet2 (略過序位欄位)
 *    - 如果 skipRanking 為 false 或無：傳送資料到 Sheet1 (包含序位欄位)
 * 3. 增加 LockService 處理高併發 (多人同時填寫) 寫入衝突的問題。
 */

const SPREADSHEET_ID = '19FHnXgYlOYbJWoRY8f-AdGBUyZkv4jyX-8_DDv_5vX4'; // 替換為你的試算表 ID
const SHEET_NAME_FULL = 'Sheet1'; // 有提供序位的資料表名稱
const SHEET_NAME_SKIP = 'Sheet2'; // 不提供序位的資料表名稱

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 設定有提供序位的資料表
  let sheetFull = ss.getSheetByName(SHEET_NAME_FULL);
  if (!sheetFull) {
    sheetFull = ss.insertSheet(SHEET_NAME_FULL);
  }
  if (sheetFull.getLastRow() === 0) {
    sheetFull.appendRow([
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
    sheetSkip.appendRow([
      '時間戳記', '區域', '會考年度', '國文成績', '數學成績', '英文成績', '社會成績', '自然成績', '作文成績', 'email'
    ]);
  }
}

function doPost(e) {
  // 使用 LockService 避免多人同時寫入發生衝突
  const lock = LockService.getScriptLock();
  
  try {
    // 嘗試取得鎖定，最多等待 10 秒
    lock.waitLock(10000);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
       return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No data provided" }))
         .setMimeType(ContentService.MimeType.JSON);
    }
    
    const timestamp = data.timestamp || new Date().toISOString();
    
    // 依據 skipRanking 欄位判斷寫入哪個工作表
    if (data.skipRanking) {
      // 不提供序位，寫入 Sheet2
      let sheetSkip = ss.getSheetByName(SHEET_NAME_SKIP);
      if (!sheetSkip) sheetSkip = ss.insertSheet(SHEET_NAME_SKIP);
      
      sheetSkip.appendRow([
        timestamp,
        data.region || '',
        data.examYear || '',
        data.chineseScore || '',
        data.mathScore || '',
        data.englishScore || '',
        data.socialScore || '',
        data.scienceScore || '',
        data.essayScore || '',
        data.email || ''
      ]);
    } else {
      // 有提供序位，寫入 Sheet1
      let sheetFull = ss.getSheetByName(SHEET_NAME_FULL);
      if (!sheetFull) sheetFull = ss.insertSheet(SHEET_NAME_FULL);
      
      sheetFull.appendRow([
        timestamp,
        data.region || '',
        data.examYear || '',
        data.chineseScore || '',
        data.mathScore || '',
        data.englishScore || '',
        data.socialScore || '',
        data.scienceScore || '',
        data.essayScore || '',
        data.minRatio || '',
        data.maxRatio || '',
        data.minRankInterval || '',
        data.maxRankInterval || '',
        data.email || ''
      ]);
    }
    
    // 確保資料寫入完成再解鎖
    SpreadsheetApp.flush();
    
    // 產生邀請碼 (台灣時間 UTC+8)
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, "GMT+8", "yyyyMMddHH");
    const inviteCode = "SH" + formattedDate;
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", inviteCode: inviteCode }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    // 釋放鎖定
    lock.releaseLock();
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

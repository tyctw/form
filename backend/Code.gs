/*
 * TW會考落點分析平台 - Google Apps Script Backend v2.0
 * 
 * 對應前端: services/codeGenerator.ts
 * 
 * [部署說明]
 * 1. 建立 Google Sheet，命名為 "TW會考落點分析資料庫"
 * 2. 點擊 "擴充功能" > "Apps Script"
 * 3. 將此檔案內容複製到 Code.gs
 * 4. 修改下方的 ADMIN_PASSWORD
 * 5. 執行 setup() 函式以初始化工作表 (只需執行一次)
 * 6. 部署為網頁應用程式 (執行身分: 我, 存取權限: 所有人)
 */

// ==========================================
// 1. 系統設定 (請依需求修改)
// ==========================================
const ADMIN_PASSWORD = "admin123"; // ⚠️ 請務必更改此密碼，用於前端管理後台登入
const SHEET_RECORDS_NAME = "Records"; // 儲存申請紀錄的工作表名稱
const SHEET_CONFIG_NAME = "Config";   // 儲存系統設定的工作表名稱

// ==========================================
// 2. 主程式入口 (doGet)
// ==========================================
function doGet(e) {
  // 使用 LockService 避免並發寫入時產生衝突
  const lock = LockService.getScriptLock();
  // 嘗試獲取鎖定，最多等待 10 秒
  const success = lock.tryLock(10000); 
  
  if (!success) {
    return createResponse({ error: "Server busy, please try again." });
  }

  try {
    const params = e.parameter;
    const action = params.action;

    // 路由處理
    if (!action) {
      // 預設動作：生成邀請碼
      return handleGenerateCode(params);
    }

    switch (action) {
      case 'getAdminData':
        return handleGetAdminData(params);
      case 'updateStatus':
        return handleUpdateStatus(params);
      case 'getConfig':
        return handleGetConfig();
      case 'updateConfig':
        return handleUpdateConfig(params);
      default:
        return createResponse({ error: "Unknown action: " + action });
    }

  } catch (error) {
    Logger.log("Error: " + error.toString());
    return createResponse({ error: error.toString() });
  } finally {
    // 確保釋放鎖定
    lock.releaseLock();
  }
}

// ==========================================
// 3. 業務邏輯處理函式
// ==========================================

/**
 * 處理生成邀請碼請求
 * 接收使用者資料，生成代碼，並寫入 Google Sheet
 */
function handleGenerateCode(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS_NAME);
  
  if (!sheet) throw new Error("Database sheet not found. Please run setup() first.");

  // 1. 準備時間戳記與 ID
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
  const uniqueId = "REC-" + now.getTime().toString(36).toUpperCase();
  
  // 2. 生成邀請碼邏輯 (TW + 年月日小時 + 4位隨機碼)
  // 例如: TW20250520148899
  const year = now.getFullYear();
  const month = ("0" + (now.getMonth() + 1)).slice(-2);
  const day = ("0" + now.getDate()).slice(-2);
  const hour = ("0" + now.getHours()).slice(-2);
  const randomSuffix = Math.floor(Math.random() * 9000 + 1000); 
  const invitationCode = `TW${year}${month}${day}${hour}${randomSuffix}`;

  // 3. 準備寫入資料列
  // 欄位順序需與 setup() 中的 headers 對應:
  // [ID, Email, Identity, Region, Source, Code, Timestamp, Status, 
  //  Chinese, Math, English, Social, Science, Composition, 
  //  RankMinPercent, RankMaxPercent, RankMin, RankMax, UserAgent]
  
  const rowData = [
    uniqueId,
    params.email || "",
    params.identity || "",
    params.region || "",
    params.source || "",
    invitationCode,
    timestamp,
    "active", // 預設狀態
    // 成績欄位 (若前端未傳送則為空字串)
    params.chinese || "",
    params.math || "",
    params.english || "",
    params.social || "",
    params.science || "",
    params.composition || "",
    // 序位欄位
    params.rankMinPercent || "",
    params.rankMaxPercent || "",
    params.rankMin || "",
    params.rankMax || "",
    // 其他資訊
    params.userAgent || ""
  ];

  // 4. 寫入 Sheet
  sheet.appendRow(rowData);

  // 5. 回傳結果給前端
  return createResponse({ 
    success: true, 
    invitationCode: invitationCode,
    id: uniqueId
  });
}

/**
 * 獲取管理員後台資料
 * 需驗證密碼
 */
function handleGetAdminData(params) {
  if (params.password !== ADMIN_PASSWORD) {
    return createResponse({ error: "Invalid password" });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS_NAME);
  
  if (!sheet) return createResponse({ success: true, data: [] });

  const data = sheet.getDataRange().getValues();
  
  // 移除標題列
  const headers = data.shift();
  
  if (data.length === 0) return createResponse({ success: true, data: [] });

  // 將二維陣列轉換為物件陣列，方便前端使用
  const records = data.map(row => {
    return {
      id: row[0],
      email: row[1],
      identity: row[2],
      region: row[3],
      source: row[4],
      code: row[5],
      timestamp: row[6],
      status: row[7],
      scores: {
        chinese: row[8],
        math: row[9],
        english: row[10],
        social: row[11],
        science: row[12],
        composition: row[13],
        rankMinPercent: row[14],
        rankMaxPercent: row[15],
        rankMin: row[16],
        rankMax: row[17]
      }
    };
  }).reverse(); // 反轉陣列，讓最新的資料排在最前面

  return createResponse({ success: true, data: records });
}

/**
 * 更新紀錄狀態 (例如將邀請碼設為 active 或 expired)
 */
function handleUpdateStatus(params) {
  if (params.password !== ADMIN_PASSWORD) {
    return createResponse({ error: "Invalid password" });
  }

  const idToUpdate = params.id;
  const newStatus = params.status;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RECORDS_NAME);
  const data = sheet.getDataRange().getValues();

  // 搜尋對應 ID 的列 (跳過標題列，所以從 i=1 開始)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idToUpdate) {
      // 狀態欄位在第 8 欄 (Index 7) 
      // getRange 是 1-based index，所以 row 是 i+1, column 是 8
      sheet.getRange(i + 1, 8).setValue(newStatus);
      return createResponse({ success: true });
    }
  }

  return createResponse({ error: "Record not found" });
}

/**
 * 獲取系統設定 (開放填寫時間)
 */
function handleGetConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
  
  // 若無設定表，回傳空值
  if (!sheet) {
    return createResponse({ success: true, data: { scoreEntryStart: "", scoreEntryEnd: "" } });
  }

  const data = sheet.getDataRange().getValues();
  const config = {
    scoreEntryStart: "",
    scoreEntryEnd: ""
  };

  // 讀取 Key-Value 設定
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "scoreEntryStart") config.scoreEntryStart = data[i][1];
    if (data[i][0] === "scoreEntryEnd") config.scoreEntryEnd = data[i][1];
  }

  return createResponse({ success: true, data: config });
}

/**
 * 更新系統設定
 */
function handleUpdateConfig(params) {
  if (params.password !== ADMIN_PASSWORD) {
    return createResponse({ error: "Invalid password" });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CONFIG_NAME);
    sheet.appendRow(["Key", "Value"]);
  }

  // 清空舊設定並重寫
  sheet.clear();
  sheet.appendRow(["Key", "Value"]);
  
  // 確保寫入字串格式
  const start = params.scoreEntryStart || "";
  const end = params.scoreEntryEnd || "";
  
  sheet.appendRow(["scoreEntryStart", start]);
  sheet.appendRow(["scoreEntryEnd", end]);

  return createResponse({ success: true });
}

// ==========================================
// 4. 輔助與初始化函式
// ==========================================

/**
 * 建立標準 JSON 回傳格式
 */
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 初始化試算表結構
 * 請在部署前手動執行一次此函式
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 初始化紀錄工作表 (Records)
  let recordsSheet = ss.getSheetByName(SHEET_RECORDS_NAME);
  if (!recordsSheet) {
    recordsSheet = ss.insertSheet(SHEET_RECORDS_NAME);
    // 移除預設工作表
    const defaultSheets = ["工作表1", "Sheet1"];
    defaultSheets.forEach(name => {
      const s = ss.getSheetByName(name);
      if (s) ss.deleteSheet(s);
    });
  }
  
  // 設定欄位標題
  const headers = [
    "ID", "Email", "Identity", "Region", "Source", "Invitation Code", "Timestamp", "Status",
    "Chinese", "Math", "English", "Social", "Science", "Composition",
    "RankMinPercent", "RankMaxPercent", "RankMin", "RankMax", "UserAgent"
  ];
  
  // 若工作表為空，則寫入標題與格式
  if (recordsSheet.getLastRow() === 0) {
    recordsSheet.appendRow(headers);
    const headerRange = recordsSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold")
               .setBackground("#e0f2f1") // 淺青色背景
               .setBorder(true, true, true, true, true, true);
    recordsSheet.setFrozenRows(1); // 凍結第一列
  }

  // 2. 初始化設定工作表 (Config)
  let configSheet = ss.getSheetByName(SHEET_CONFIG_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEET_CONFIG_NAME);
    configSheet.appendRow(["Key", "Value"]);
    configSheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#fff9c4"); // 淺黃色
    
    // 初始化空設定
    configSheet.appendRow(["scoreEntryStart", ""]);
    configSheet.appendRow(["scoreEntryEnd", ""]);
  }
  
  Logger.log("Setup complete! Database sheets are ready.");
}
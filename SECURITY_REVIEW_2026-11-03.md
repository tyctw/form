# 資安複查（2026-11-03，Asia/Taipei）

範圍：此資料夾的 React/Vite 前端、Supabase schema 與 001–004 migrations、GAS 後端、匯入腳本、GitHub Actions，以及 lockfile 的最新 npm audit。未連線正式 Supabase、GAS 或網站，未讀寫正式使用者資料，未修改應用程式或相依套件。此資料夾沒有 `.git`，無法檢查版本歷史中的秘密或變更。

## 仍須處理的問題

### 1. 高（若仍公開部署）：GAS 未驗證就回傳個資

- 位置：`GAS_Backend.js:101–126`。
- `doGet` 不檢查任何登入或授權，直接取得主要工作表全部列與欄位並輸出 JSON。若 Web App 以擁有者身分執行且允許任何人存取，訪客就能讀取 Email、成績等資料。
- 已用 VM 與假試算表重現：呼叫 `doGet({})`，未提供憑證即可得到 `[{"email":"audit@example.invalid","國文成績":"A++"}]`。
- 修正：停用舊 Web App 部署，或關閉此資料讀取入口；需要管理查詢時，改走真正驗證管理員權限的後端。更新原始碼不會撤銷已發布的舊 GAS 版本。

### 2. 中：匿名可修改舊管理密碼，明碼及預設密碼仍保留

- 位置：`supabase_schema.sql:175–179`、`:222–237`。
- `admin_users.password` 是明碼且新建時預設 `admin123`。`update_admin_password` 是 SECURITY DEFINER，沒有檢查管理員身分、固定安全 search_path 或撤回 PUBLIC EXECUTE。004 migration 只撤回 `verify_admin_password`，沒有封鎖修改密碼的函式。
- 使用完整 schema 建立隔離 PGlite 資料庫後，`SET ROLE anon; SELECT public.update_admin_password('admin123','audit-only-temp-password');` 回傳 true；切回擁有者後確認資料列已改變。同時確認 `verify_admin_password` 的匿名執行權已被撤回。
- 影響：可修改或猜測舊機制的密碼；目前前端使用 Supabase Auth，沒有證據顯示此 RPC 能接管目前管理員帳號，因此本次將此項評為中風險。
- 修正：確認沒有舊服務依賴後，移除舊 RPC 與明碼資料表，並提供既有資料庫 migration；過渡期至少撤回 PUBLIC、anon、authenticated 的執行權。只有更換預設密碼不能解決舊介面缺少授權的問題。
- PostgreSQL 新函式預設授予 PUBLIC EXECUTE，見[官方 CREATE FUNCTION 說明](https://www.postgresql.org/docs/current/sql-createfunction.html)。實際線上權限可能另有修改，仍需核對。

### 3. 中：匿名提交可藉更換 Email 繞過頻率限制

- 位置：`supabase_schema.sql:464–469`；`migrations/003_validated_survey_submission.sql` 同一段邏輯。
- 目前只對正規化後的 Email 限制每 60 秒一次，Email 未經所有權驗證。攻擊者可持續更換 Email 和 request UUID，新增填答、throttle 與 receipt 資料，污染統計並消耗容量。request UUID 去重只防止相同請求重送。
- 修正：在可信的提交入口加入 CAPTCHA 驗證與流量限制，並避免讓公開 RPC 繞過新增的驗證入口；依需求增加 Email 驗證及提交總額限制。將瀏覽器倒數或按鈕停用視為介面功能，不作為安全限制。

### 4. 中（若邀請碼用於授權）：邀請碼可預測，且同小時共用

- 位置：`supabase_schema.sql:471–472`；`src/pages/Home.tsx:321`。
- 邀請碼只由 `SH` 加台北日期與小時組成，不含隨機值，也沒有為每位填答者產生不同 token。知道當前時間即可自行組出相同代碼，無須填表。
- 本專案只產生與轉交邀請碼，未包含下游驗證端；若代碼僅作標記，此項不構成授權繞過。若落點分析系統靠它限制資格或存取，就不能當成安全憑證。
- 修正：先核對下游用途；需要存取控制時，使用密碼學安全的隨機 token，伺服器端驗證到期、使用次數及綁定對象，並同步修改下游。

### 5. 套件漏洞通報：13 個受影響套件，須依實際使用情境處理

- 最新 `npm audit --package-lock-only --ignore-scripts --json`：critical 1、high 7、moderate 4、low 1。這是套件統計，並非 13 條已證實可利用的網站漏洞。
- 原始結果：`SECURITY_AUDIT_DEPENDENCIES_2026-11-03.json`。所有項目的 `fixAvailable` 都為 true；修復版本與相容性仍須更新後驗證。
- `proxy-addr@2.0.7`：critical，IP 信任判斷問題，經 `express@4.22.2` 引入。未發現應用程式有執行 Express 服務；目前 GitHub Pages 為靜態部署，因此未證實有網站可利用路徑。通報：[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)。
- `vite@6.4.2`：high，含開發伺服器與 launch-editor 問題；`npm run dev` 綁定 `0.0.0.0`。部分通報限定 Windows 或特定編輯器。應更新修補版本並避免將開發伺服器公開。通報例：[GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm)。
- `react-router@7.17.0`：high，含 SSR/RSC、跳轉與路由比對通報。本專案使用固定 HashRouter 路由，未使用 SSR/RSC，不能把那些通報直接視為本網站已存在 XSS/CSRF。仍應更新並驗證路由。通報例：[GHSA-chx6-hx7r-mcp5](https://github.com/advisories/GHSA-chx6-hx7r-mcp5)。
- 其餘受影響套件：baseline-browser-mapping、body-parser、browserslist、esbuild、nanoid、postcss、protobufjs、qs、react-router-dom、source-map-js。包含建置工具與未使用後端套件，完整範圍見 JSON。
- 建議移除未使用的 Express、GenAI 等相依，更新其餘套件與 lockfile，執行乾淨安裝、型別檢查、安全測試及建置；不要直接使用 `npm audit fix --force` 略過相容性評估。

## 額外加固：管理頁載入第三方腳本

`index.html:14`、`:28` 全站載入廣告與分析腳本，包含同一 SPA 的管理登入頁。`src/supabase.ts:10` 採預設 session 儲存；Supabase 預設將 session 保存在 localStorage，見[官方文件](https://supabase.com/docs/reference/javascript/auth)。

這不是已發現第三方遭入侵，而是信任範圍：頁面腳本能接觸登入表單、管理資料及同源儲存。建議管理介面使用不載入廣告／分析的獨立入口，最好分離 origin，並設定適當 CSP。只在切換到管理路由後移除 script 標籤，無法撤銷已執行腳本的權限。

## 已通過的離線驗證

- `node --test tests/submission-client.test.mjs tests/spreadsheet-injection.test.mjs tests/survey-config.test.mjs`：10/10 通過。
- `survey-read-access.cjs`：匿名讀取拒絕、普通帳號看不到原始填答、管理員可讀、殘留 policy／欄位授權無法繞過。
- `config-write-access.cjs`：公開讀設定、僅管理員寫入、空表新增、撤權、殘留規則與 migration 重跑。
- `survey-submission.cjs`：伺服器驗證、開放時間、自訂題目、直接寫入封鎖、Email 冷卻、重送去重。
- `admin-log-access.cjs`：管理員讀取、禁止客戶端偽造、Auth 事件觸發、去重與撤權。
- 四組資料庫測試使用安裝於 `/tmp` 的 PGlite，未變更本專案的相依套件；另以隔離資料庫和 VM 重現上述兩個問題。

本次未執行瀏覽器測試、型別檢查與正式建置。未提供線上連線設定，因此無法確認 001–004 migrations、Auth 稽核日誌開關、正式 grants/RLS、GAS 公開部署狀態或網站回應標頭。先前報告中的「本機已修補」不能當成「線上已安全」的證據。

## 處理順序

1. 查核並關閉仍公開輸出個資的 GAS 部署。
2. 核對正式 Supabase 已套用 001–004 migrations，確認匿名／一般帳號無法讀取填答或修改設定。
3. 移除舊明碼認證與修改密碼 RPC。
4. 更新有通報的相依，優先處理對外開發伺服器與實際使用的執行路徑。
5. 補強防灌票、確認邀請碼用途，隔離管理頁的第三方腳本。

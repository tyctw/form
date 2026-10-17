# 資安檢查報告

檢查日期：2026-10-17（Asia/Taipei）

範圍：本機原始碼、SQL、Google Apps Script 範例後端、部署設定、dist 字串掃描，以及依 package-lock.json 向 npm 查詢的漏洞資訊。未連線測試正式 Supabase 或 Google Apps Script，未讀寫正式使用者資料；以下部署相關風險須核對實際 grants、RLS、RPC 權限與部署方式。原始檢查階段未修改應用程式、資料庫或套件版本；後續本機修復進度見下文。

## 優先處理

第 7 項驗證補充：管理日誌的實際 PostgreSQL 權限與觸發器測試通過，包含匿名／一般帳號讀取限制、所有客戶端寫入限制、來源表與舊 RPC 偽造阻擋、歷史資料標示、事件去重、交易回滾、舊 id 與 sequence 同步及移除管理員後撤權。第 1、2、6 項回歸測試、8 組前端／GAS／公式注入測試、TypeScript 檢查與正式建置亦通過。尚未套用正式資料庫與驗證服務設定。

第 6 項驗證補充：提交資料庫測試及第 1、2 項權限回歸測試全部通過；前台／GAS／公式注入共 8 組測試、TypeScript 檢查及正式建置亦通過。線上設定與部署尚未更新。

另：第 5 項公式注入已完成本機程式修復與測試，部署方式與限制見第 5 項及 README。

第 5 項驗證補充：公式注入測試 5 組、TypeScript 檢查與正式建置均通過。原有 lockfile 缺少部分平台套件，npm ci 失敗；使用 npm install --ignore-scripts --no-package-lock 安裝後完成建置（實際安裝的 Vite 為 6.4.4）。package.json 與 package-lock.json 未修改，原有部署流程的 npm ci 問題仍待另行修復，且本次建置不代表 lockfile 所鎖版本已更新。

修復進度（2026-10-17）：第 1、2 項已完成本機修補，包含更新 schema、既有資料庫 migration 與管理員名單。離線 PostgreSQL 權限測試已通過匿名／一般帳號／管理員、匿名填表、設定公開讀取與管理員新增／修改（含空表新增）、移除管理員後撤銷權限、殘留寬鬆 policy 與欄位授權、重複執行 migration 等情境。第 1 項回歸測試亦通過。尚未套用到正式 Supabase；須依 README 依序執行 001、002 migration 並加入管理員 UID。下列保留原始稽核發現；第 5、6、7 項另見各節修復狀態，第 3、4、8 項未完整修復。

### 1. 高：填答資料允許公開讀取

- 位置：supabase_schema.sql:88–92；Email 欄位在第 19、41 行。
- 兩個填答表的 SELECT policy 都是 USING (true)，沒有角色或管理員判斷。若 Data API 的 anon 具有 SELECT grant，任何取得公開前端 anon key 的人都可直接讀取 Email、成績、序位與自訂回答，無須登入管理頁。
- 修正：移除公開 SELECT policy，改為 TO authenticated 且驗證真正的管理員角色；公開圖表透過受控彙總介面提供，避免暴露原始個資。anon key 是公開用戶端金鑰，本身不是應隱藏的秘密，保護必須落在資料庫授權。

### 2. 高：系統設定可遭未授權修改

- 位置：supabase_schema.sql:95–98。
- 名稱寫著 authenticated，但 policy 並沒有 TO authenticated，而且 USING / WITH CHECK 都是 true。具對應表權限的 anon 或一般使用者可直接更新公告、開關系統或插入設定。前端登入無法保護這條 API 路徑。
- 修正：刪除寬鬆的舊 policy，再建立僅管理員可 INSERT / UPDATE 的 policy 與適當 grants。只新增嚴格 policy 不足以封鎖原有 permissive policy。
- 相關部署缺口：src/pages/Admin.tsx:72、122 依賴 is_admin RPC，但專案 SQL 沒有建立該函式或管理員身分機制；僅執行附帶 SQL 不能完成目前前端的安全登入流程。

### 3. 高：舊密碼機制保留預設明碼密碼及高權限 RPC

- 位置：supabase_schema.sql:104–109、127–167。
- admin_users 使用明碼 password，預設值為 admin123。verify_admin_password 與 update_admin_password 為 SECURITY DEFINER，沒有在此檔限制 EXECUTE、固定 search_path 或實作呼叫頻率限制。
- 在 RPC 可被公開呼叫且沿用預設密碼時，可驗證預設密碼或修改舊管理密碼；暴力嘗試也會產生大量日誌。這是舊密碼機制風險，不代表能用 admin123 登入目前採 Supabase Auth 的前端。
- 修正：統一採 Supabase Auth 與受保護的管理員名單，移除不再使用的明碼資料表和舊 RPC，檢查已部署函式權限；若仍使用此密碼，立即更換。保留的 SECURITY DEFINER 函式應限制執行者並固定安全 search_path。

### 4. 高（取決於是否仍公開部署）：GAS 後端直接輸出整份資料

- 位置：GAS_Backend.js:125–150。
- doGet 不做驗證，讀取主要工作表全部列與全部欄位並輸出 JSON，包含 Email。若此 Web App 以擁有者身分執行且開放任何人存取，可透過公開端點讀取整份資料。
- 修正：停用不再使用的公開部署；需要保留時，將個資讀取移至有真正驗證的管理服務，公開端點只提供去識別化彙總。

### 5. 中：試算表公式注入

修復狀態：已完成本機修補。`src/utils/spreadsheet.ts` 統一處理 CSV 欄位，GAS 的所有 appendRow 透過相同前綴規則保護。危險文字以單引號前綴標記為文字，有限數值與布林型別保留；涵蓋公式符號、全形符號、前導空白／控制字元／常見不可見字元。5 組自動測試通過，包含實際管理頁匯出列、兩個 GAS doPost 分支、CSV 欄位邊界與正常資料。尚未部署，未在真實 Excel／Google Sheets 中執行；舊試算表內已存在的公式需另行處理。以下為原始發現。

- 位置：src/pages/Admin.tsx:397–416；GAS_Backend.js:70–102。
- CSV 匯出只處理雙引號，未將以 =、+、-、@ 或控制字元開頭的文字轉為安全文字。公開寫入 API 可繞過網頁欄位限制，攻擊者可將公式存入 region 等文字欄位；管理員在支援公式的試算表程式開啟 CSV 時可能觸發公式，實際行為取決於軟體及設定。
- GAS appendRow 直接接收不可信字串，Google Sheets 會將以 = 開頭的內容解讀為公式。離線模擬以 =1+1 作為 region，確認原字串未經處理就傳入 appendRow；未向真實試算表寫入。
- 修正：在每個寫入或匯出邊界將使用者文字安全地處理為文字，考慮前導空白與控制字元；若改用 XLSX，明確將不可信內容設為字串儲存格。

### 6. 中：表單限制僅存在瀏覽器，缺少可信的提交驗證

修復狀態：已完成本機 SQL／前端／GAS 修補。新增 `003_validated_survey_submission.sql` 與 `submit_survey` RPC，伺服器驗證開放時間、欄位／數值、自訂題目與大小限制，封鎖直接寫入填答表；加入 Email 冷卻與 request UUID 重送去重。GAS POST 改走同一 RPC，未設定時拒絕提交。第 1 項原本的「匿名直接 INSERT」驗收自此改為「匿名只能透過 RPC 提交」。待依 README 套用資料庫腳本、前端及 GAS 部署；舊 GAS doGet 的第 4 項風險與第 8 項邀請碼可預測風險尚未修復。Email 冷卻不等於大規模機器人防護，仍可能被更換 Email 繞過。以下為原始發現。

- 位置：supabase_schema.sql:74–78；src/pages/Home.tsx:164–190、235–280、287–330。
- INSERT policy 為 WITH CHECK (true)，SQL 除少數 NOT NULL 與型別外未限制欄位格式、長度、成績範圍、系統開放時間或必填答案。直接呼叫 API 可在表單關閉後持續寫入，並偽造資料、填寫時間或大量灌入資料。
- 修正：由受控提交端點或資料庫函式驗證系統狀態、欄位與長度，搭配資料庫約束及伺服端防濫用措施。若採受控端點，必須一併取消可繞過端點的直接公開 INSERT。

### 7. 中：管理日誌可被公開讀取及偽造

修復狀態：已完成本機修補。`004_trusted_admin_logs.sql` 限制管理員讀取、封鎖所有客戶端直接寫入及舊驗證 RPC 間接偽造路徑；新紀錄由 Supabase Auth 的資料庫事件觸發，不依賴前端提交的 SUCCESS、IP、User Agent 或 metadata。歷史資料保留並標示為來源未驗證；僅收錄管理員的成功登入，失敗事件應查閱驗證服務的系統紀錄。部署需啟用 Auth audit logs 的資料庫儲存，再套用 migration 與前端；尚未連線正式環境驗證。第 3 項明碼密碼機制只撤回了相關舊驗證 RPC 的客戶端執行權限，仍未完整移除。以下保留原始發現。

- 位置：supabase_schema.sql:123–124；src/pages/Admin.tsx:128。
- policy 允許公開 SELECT / INSERT，在具對應 grants 時可讀取 IP、User-Agent，或偽造 SUCCESS / FAILED 紀錄。前端自行寫入 SUCCESS 也無法作為可信稽核依據。
- 修正：日誌僅管理員可讀；由可信的驗證後端產生事件，限制外部直接寫入。登入失敗紀錄應由真正處理登入的系統提供。

### 8. 中（跨站存取控制用途時）：邀請碼可預測且整個小時共用

- 位置：src/pages/Home.tsx:75–88、295；GAS_Backend.js:110–114。
- 邀請碼是 SH 加年月日時，完全由公開程式和時鐘生成，同一小時相同；前端的到期顯示不構成伺服端撤銷。
- 若下游將此碼當作填表證明、存取許可或個人資料識別，無法提供安全保證。本專案沒有下游驗證程式，因此未確認下游是否存在實際越權。
- 修正：若需要權限用途，由伺服端產生高熵亂數或簽章 token，於下游檢查有效期、用途與使用次數。

## 相依套件掃描

使用 npm audit --package-lock-only --json，完整結果存於 SECURITY_AUDIT_DEPENDENCIES.json。

| npm 嚴重程度 | 受影響套件數 |
| --- | ---: |
| Critical | 1 |
| High | 6 |
| Moderate | 6 |
| Low | 1 |
| 合計 | 14 |

這是套件層級的掃描數量，包含間接依賴與傳遞影響，不等於 14 個可在正式網站利用的漏洞。

- **最貼近本機環境的風險**：lockfile 固定 Vite 6.4.2，package.json:7 又使用 --host=0.0.0.0。在 Windows 開發伺服器可被網路存取、允許目錄中有敏感檔案等條件下，已知路徑繞過可讀取原本受限制的檔案。維護者公告的 6.x 修正版是 6.4.3。升級並將預設開發服務限制在 localhost；GitHub Pages 的靜態網站不會因此直接變成 Vite 開發伺服器。
- **Critical**：proxy-addr 2.0.7，掃描指出 IPv4-mapped IPv6 trust subnet 的 IP 偽冒問題。未在本專案找到 Express 伺服器或 trust proxy 設定，不能認定正式靜態網站可被此漏洞利用。
- **其他 High**：browserslist、nanoid、postcss、react-router、source-map-js。React Router 多個通報涉及 SSR / RSC，而本專案採用前端路由，需逐項確認適用條件。建置工具的漏洞也需不可信輸入才能觸發。
- 建議移除未使用的 Express / GenAI 等依賴，更新其餘套件與 lockfile，再執行型別檢查及正式建置。此次檢查沒有安裝套件、執行安裝腳本或修改 lockfile。

## 查核限制與修正驗收

- 未發現符合此次掃描模式的明碼 service-role key、Gemini key 或私鑰；這不是完整的密鑰或歷史洩漏證明。此資料夾沒有 Git 歷史，無法查核先前提交。
- 未取得正式 Supabase 設定，不能宣稱正式資料已外洩。請先核對 pg_policies、表權限、RPC EXECUTE、管理員身分來源及現存 GAS 部署。
- 修正後以匿名、一般登入使用者、管理員三種身分驗證：只有管理員能讀取原始填答及日誌、變更設定；匿名只能取得必要公開設定並經驗證提交；關閉系統後所有提交路徑都必須被伺服端拒絕。
- 本次是程式碼與依賴稽核，未執行正式環境滲透測試，也沒有將型別檢查或建置宣稱為已通過。

## 參考依據

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)：policy 的角色與條件。
- [Supabase API 授權](https://supabase.com/docs/guides/api/securing-your-api)：table grants 與 RLS 應同時檢查。
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)：函式執行權限與 SECURITY DEFINER。
- [Google Apps Script Sheet.appendRow](https://developers.google.com/apps-script/reference/spreadsheet/sheet#appendRow(Object))：等號開頭字串會解讀為公式。
- [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)：匯出不可信內容的公式注入風險。
- [Vite 維護者安全公告](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)：Windows 路徑繞過條件與修正版。

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/219f804d-0935-4d95-a534-988e445e4fad

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 修復填答資料的公開讀取權限

既有 Supabase 專案：在 SQL Editor 以資料庫管理者身分執行
[`migrations/001_private_survey_responses.sql`](migrations/001_private_survey_responses.sql)。
此腳本可重複執行，保留填答資料與匿名新增功能，將原始填答限制為管理員可讀。
修改本機檔案或重新部署前端不會自動更新線上資料庫。

新專案：執行 `supabase_schema.sql`，已包含相同的填答讀取保護。
填答資料與系統設定的修復進度請參閱 `SECURITY_REVIEW.md`。

管理員須先在 Supabase Authentication 建立帳號，再由資料庫管理者將該帳號
的 User UID 加入名單（將下列 UUID 換成實際值）：

```sql
INSERT INTO public.survey_admins (user_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
```

前端既有的 `is_admin()` 檢查與資料表 RLS 使用同一份名單。一般帳號無法自行
加入名單；名單為空時所有一般用戶端均無法讀取填答。若既有專案自訂過同名的
`is_admin()`，本腳本將統一改為此名單，請把原有管理員 UID 一併加入。
移除管理權限時，由資料庫管理者刪除對應名單列即可。

驗收時，分別以匿名、一般登入帳號與名單中的管理員呼叫兩個填答表：
匿名讀取應被拒絕，一般帳號應得到空資料，管理員可讀取；匿名新增仍應成功。
資料庫擁有者與 service-role 的後端維護權限不受此用戶端限制。

離線權限測試位於 `tests/survey-read-access.cjs`，使用獨立的 PGlite PostgreSQL
環境執行，不連線正式資料庫：

```text
node tests/survey-read-access.cjs <已安裝的 @electric-sql/pglite 套件絕對路徑>
```

## 修復系統設定的未授權修改

既有 Supabase 專案：先完成上述 `001` 修復與管理員名單設定，再以 SQL Editor
的資料庫管理者身分執行
[`migrations/002_admin_survey_config.sql`](migrations/002_admin_survey_config.sql)。
新專案的 `supabase_schema.sql` 已包含此修復。

設定仍可公開讀取；只有 `survey_admins` 名單中的登入帳號能新增或修改。
腳本會移除舊的寬鬆新增／修改規則，並以 restrictive policy 阻擋其他殘留規則
放行非管理員。用戶端刪除與清空設定表也被禁止。資料庫管理者仍可維護資料。
本機更新及前端部署不會自動套用此資料庫腳本。

驗收：匿名與一般帳號可讀取設定，但不能新增或修改；管理員能儲存設定，
設定表為空時也能新增。移出管理員名單後，原登入帳號應立即失去寫入權限。
離線測試同時覆蓋新專案與既有資料庫升級、殘留寬鬆規則及重複執行腳本：

```text
node tests/config-write-access.cjs <已安裝的 @electric-sql/pglite 套件絕對路徑>
```

## 修復試算表公式注入

CSV 匯出的每個欄位會先處理可能的公式前綴，再進行 CSV 引號跳脫；
`GAS_Backend.js` 的所有新增資料列也會經過同樣的文字防護。
危險前綴（包括公式符號、前導空白與控制字元）會加上單引號文字標記，
保留原內容；真正的數值與布林值維持原型別。部分 CSV 匯入工具可能顯示
這個單引號，請勿在匯入時移除文字標記或指定將這些欄位轉成公式。

前端需重新建置並部署，新的 CSV 匯出才會套用修復，既有資料匯出時也會受到保護。
若仍使用 GAS，請將更新後的完整 `GAS_Backend.js` 貼入 Apps Script，
並更新 Web App 部署版本。此修復保護新的寫入，不會清除舊試算表中已存在的公式，
也不會修改先前下載的 CSV。

公式注入回歸測試（Node.js 24，可直接執行，不需安裝測試套件）：

```text
node --test tests/spreadsheet-injection.test.mjs
```

此次修復已通過公式注入測試、TypeScript 檢查與正式建置。原有 lockfile 缺少
部分平台相依項目，`npm ci` 仍會失敗；此次以不寫入 lockfile 的方式安裝後驗證，
未修改套件宣告或鎖定檔。建置成功不代表既有 GitHub Actions 的安裝問題已修復。

## 可信的表單提交驗證（第 6 項）

**此節取代前文「匿名直接新增仍成功」的驗收方式。** 匿名仍可填表，但只能呼叫
`submit_survey`，對兩個填答表直接 INSERT / UPDATE / DELETE / TRUNCATE 都被封鎖。
即使殘留舊的寬鬆 policy 或欄位授權，直接寫入也不能繞過驗證。

部署順序：

1. 既有資料庫先完成 `001`、`002`，再於 Supabase SQL Editor 以 postgres 身分執行
   [`migrations/003_validated_survey_submission.sql`](migrations/003_validated_survey_submission.sql)。
   腳本可重複執行，保留既有填答。新專案執行完整 `supabase_schema.sql` 即包含此修復。
2. 重新建置並部署前端。資料庫更新後，舊前端的直接寫入會被拒絕；維護期間可暫時關閉表單，
   等前端更新完成再開放。不要為了相容舊前端恢復公開 INSERT。
3. 若仍提供 GAS Web App，必須更新其部署版本或停用舊部署，避免舊端點繼續寫入試算表。
   新版 `doPost` 只轉送 Supabase RPC，**不再直接寫入 Google Sheets**。在 Script Properties
   設定 `SUPABASE_URL`（`https://專案代碼.supabase.co`，無尾端斜線）及
   `SUPABASE_PUBLISHABLE_KEY`（`sb_publishable_` 公開金鑰）；未設定時拒絕提交。
   GAS 呼叫者使用同樣的 payload，可另傳 `requestId` UUID 以支援重試。
   `timestamp`、`inviteCode` 等舊客戶端欄位不再接受；既有 `doGet` 的個資讀取風險仍屬第 4 項。

伺服器會檢查：

- 系統與成績輸入的開關、開始及結束時間；設定表為空時拒絕提交。
- 招生區、身分、以台北日期計算的近六個會考年度、Email 格式與長度。
- 科目及作文成績選項、序位公告時間、0–100% 比率、整數序位範圍與大小順序。
- 略過序位時不可夾帶序位；成績輸入關閉時不可夾帶成績。
- 自訂題目的開放時間、必填、型別、選項、重複選項與簡答 2000 字限制。
  未開放／不存在的題目不可夾帶，前端會移除已不適用的舊答案。
- 每筆最多 32 KB；拒絕未知欄位。填寫時間、邀請碼與到期時間由伺服器產生。

同一 Email（忽略大小寫、去除頭尾空白）每 60 秒只能新增一次。
以資料庫原子操作執行冷卻判斷；同一 request UUID 與相同內容的重試只建立一筆資料。
此限制不是 Email 所有權驗證，攻擊者仍可能更換 Email；若要抵擋大規模自動化濫用，
仍需另外部署 CAPTCHA／閘道流量限制，不能把匿名問卷宣稱為完全防灌票。
邀請碼沿用原有格式；第 8 項的不可預測 token 改造不包含於此次修復。

`survey_submission_throttle` 與 `survey_submission_receipts` 僅供提交函式使用，
用戶端無權讀寫。Receipt 存請求雜湊與邀請結果，不另存整份問卷；冷卻表會存正規化 Email。
維護者可依保留政策清除舊紀錄；清除 receipt 後該 request UUID 的重送去重保證也會消失。
服務角色與資料庫管理者仍可執行可信的匯入／維護，不受用戶端 RLS 限制。

離線驗證：

```text
node tests/survey-submission.cjs <已安裝的 @electric-sql/pglite 套件絕對路徑>
node --test tests/submission-client.test.mjs tests/spreadsheet-injection.test.mjs
```

## 可信的管理日誌（第 7 項）

既有 Supabase 專案先完成 `001` 的管理員名單設定，再於 SQL Editor 以 postgres
身分執行 [`migrations/004_trusted_admin_logs.sql`](migrations/004_trusted_admin_logs.sql)，
並部署新版前端。新專案的完整 `supabase_schema.sql` 已包含相同修復。

請在 Supabase 的 Authentication → Audit Logs 設定開啟 **Write audit logs to the database**。
此開關不由 SQL 腳本管理；關閉時仍會保護日誌讀寫，但不會收到新的可信登入事件。
參考 [Supabase Auth Audit Logs 官方說明](https://supabase.com/docs/guides/auth/audit-logs)。

新版的日誌來自 `auth.audit_log_entries` 的資料庫觸發器：

- 只記錄事件發生當下在 `survey_admins` 名單中的帳號成功登入；前端不再自行寫入 SUCCESS。
- 狀態、帳號及事件時間取自驗證服務事件，並以事件 ID 去重；忽略使用者提供的狀態與 metadata。
- 只有管理員可讀取 `admin_logs`；匿名、一般帳號及管理員用戶端都不能新增、修改、刪除或清空。
  驗證服務來源表與舊 `verify_admin_password` RPC 的客戶端權限也一併收回。
- 舊日誌保留並標示為未驗證歷史紀錄，不把過去的客戶端資料視為可信登入證據。
- IP 僅使用驗證服務事件提供的值；未提供 IP 或 User Agent 時顯示 unknown，
  不使用瀏覽器傳入的值補造。密碼錯誤等失敗事件請查閱 Supabase Auth 的系統紀錄，
  本表不宣稱收錄全部登入失敗紀錄。

驗收時：重新登入管理員帳號並重新整理登入紀錄，應出現「驗證服務」來源的 SUCCESS。
一般帳號應讀不到日誌，所有用戶端的直接寫入與舊密碼驗證 RPC 都應被拒絕。
既有歷史資料不回填為新事件。觸發器與 Auth 事件在同一交易內執行，請先於測試專案
驗證登入後再套用正式專案；此處測試使用獨立 PostgreSQL，未連線正式驗證服務。

此次僅停用與偽造日誌相關的舊密碼驗證 RPC；第 3 項的明碼密碼表與舊修改密碼
RPC 並未完整移除。資料庫管理者／持有服務金鑰的可信後端仍能維護資料，
此修復不將這些特權操作宣稱為不可竄改。

離線權限與事件來源測試：

```text
node tests/admin-log-access.cjs <已安裝的 @electric-sql/pglite 套件絕對路徑>
```

## 返回頁面時出現白畫面的修復

本機已重現並修正兩種情況：不存在的 hash 路由未顯示任何頁面；自訂題目的
`options` 不是陣列時，React 因呼叫 `.map()` 崩潰。原有聯絡信箱的連結也改為
`mailto:`，避免被當成站內路徑。

目前會先驗證問卷設定；格式異常或設定載入失敗時顯示重試訊息，避免靜默忽略
必填題目。無效路由提供返回首頁連結；其他頁面渲染錯誤有復原畫面，切換頁面時
會重設錯誤狀態。應用程式尚未啟動時也有獨立載入提示，程式檔載入失敗或等待
超過 15 秒時提供重新載入按鈕，不會自動反覆重新整理。

已通過 Chrome 的 7 個開發環境情境（返回／前進、返回首頁、重新整理、無效路由、
異常題目／公告、渲染錯誤與程式檔載入失敗），以及正式建置的 3 個瀏覽器情境。
設定格式與既有提交／公式注入共 10 組測試、型別檢查及正式建置亦通過。
測試完全攔截外部請求，未連線正式資料。尚未確認使用者遇到白畫面時的實際網址，
因此這些是已重現的原因，不代表已確認所有線上故障來源。

重新部署前端後才會在線上生效。必須連同新的 `startup-recovery.js`、`index.html`
和 `assets` 一起部署，並沿用部署流程中的 Supabase 環境變數。

瀏覽器回歸測試使用外部安裝的 Playwright；先啟動本機 Vite 並使用假的 Supabase
測試連線設定，預設網址為 `http://127.0.0.1:4175/form/`：

```text
node tests/page-recovery.cjs <已安裝的 playwright 套件絕對路徑>
node --test tests/survey-config.test.mjs
```

`APP_URL` 可指定測試網址；正式建置預覽另設定 `PRODUCTION_SMOKE=1`，只執行
不依賴測試資料庫設定的瀏覽器情境。Chrome 執行檔可透過 `BROWSER_PATH` 指定。

## 本次推送的部署整理

已補齊 lockfile 缺少的 99 個平台相依項目，保留既有套件版本；推送前重新執行
`npm ci --ignore-scripts` 已通過。因此前文記錄的 lockfile 安裝失敗已在本次推送修正。
型別檢查、10 組前端／公式注入測試與正式建置亦重新通過。

`dist/` 依既有 `.gitignore` 改由 GitHub Actions 建置產生，不再將本機生成檔提交；
線上建置會使用儲存庫 secrets 的 Supabase 設定。資料庫 migrations 與 Auth 日誌
儲存設定仍須依前文手動套用，不會因推送前端自動生效。

## 管理介面的共用篩選、資料庫統計與分頁（005）

管理員可依會考年度、招生區、身分、填寫日期、是否提供序位及關鍵字篩選。
按「套用篩選」才生效；「清除篩選」回到全部資料。切換圖表／資料列表時保留篩選。
列表的「完整填寫／無序位」分頁會再限制資料類別；若與序位篩選衝突，顯示空結果。
匯出選單的「全部資料」代表所有符合共用篩選的資料，包含所有頁面。

既有資料庫部署順序：

1. 確認已套用前述 001–004 migrations 及管理員名單。
2. 以 Supabase SQL Editor 的資料庫管理者身分執行
   [`migrations/005_admin_survey_queries.sql`](migrations/005_admin_survey_queries.sql)。
   可重複執行，不刪除填答資料；新增時間索引、管理員查詢 RPC。
3. 重新建置並部署前端。先部署 SQL 再部署前端；只推送程式碼不會更新資料庫。
   新專案執行完整 `supabase_schema.sql` 即包含本次功能。

正常登入只讀統計與設定／日誌；開啟資料列表才讀當頁 10／50／100 筆。
排序與搜尋都在資料庫執行，固定以時間、來源表、ID 作為排序的補充條件。
RPC 使用 `SECURITY INVOKER`、檢查 `is_admin()` 並保留原表 RLS，匿名與普通帳號
不能讀取管理統計或原始填答。查詢錯誤不退回全量下載；介面顯示重試訊息。

日期邊界與今日統計均採 `Asia/Taipei`，結束日期包含當日全天。
每日趨勢以完整年月日分組；五科缺漏或成績值無效者列入「未完整填寫」，不混入
完整成績的積分區間。各科積分換算沿用原規則（A++=7 至 C=1）。

只有主動匯出時才分批讀取符合條件的原始資料，每次最多 500 筆，保留 CSV 公式防護。
匯出依來源表及 ID 排序，與畫面的排序可能不同；首次回傳兩張表的 ID 上限，後續
使用游標讀取，避免一般新增填答導致跨頁重複。這不是跨請求的資料庫交易快照：
匯出期間若有特權匯入以較小 ID 插入、刪除或修改既有資料，仍可能改變結果。
匯出可關閉視窗取消，登出也會中止；任一批失敗時不下載不完整檔案。
CSV 文字區塊仍在瀏覽器組成檔案，極大量匯出仍需要記憶體；本次未加入背景匯出服務。

驗證（測試使用隔離資料庫、假帳號及攔截的網路回應，不讀寫正式環境）：

```text
npm run lint
npm run build
node --test tests/submission-client.test.mjs tests/spreadsheet-injection.test.mjs tests/survey-config.test.mjs
node tests/admin-survey-queries.cjs <已安裝的 @electric-sql/pglite 套件絕對路徑>
```

瀏覽器測試另需外部安裝的 Playwright 與 Chrome。使用假的 Supabase 設定啟動 Vite：

```text
VITE_SUPABASE_URL=https://admin-test.supabase.co VITE_SUPABASE_ANON_KEY=test-public-key npm run dev -- --host 127.0.0.1 --port 4175
node tests/admin-survey-browser.cjs <已安裝的 playwright 套件絕對路徑>
```

`APP_URL` 可覆寫網址，`BROWSER_PATH` 可指定 Chrome 執行檔。
資料庫測試涵蓋權限、組合條件、日期、穩定分頁、排序、超過 1000 筆與兩表匯出、
並行新增及撤權。瀏覽器測試涵蓋共用條件、分頁、匯出、快速切換條件、錯誤重試、
桌機／手機與登出。本次沒有對正式資料量進行壓力測試；資料量成長後，應依實際
查詢計畫調整索引或彙總方式。

## 設定版本比較、總覽與選欄匯出（006）

請先完成 001–005，再於 Supabase SQL Editor 以資料庫管理者執行
[`migrations/006_admin_settings_dashboard.sql`](migrations/006_admin_settings_dashboard.sql)，
然後建置並部署前端。新專案的完整 schema 已包含 006。此腳本可重複執行，
新增公告內容欄位、設定 revision／更新時間、版本觸發器、發布 RPC，並更新統計與匯出介面。
只有前端部署不會更新線上資料庫。SQL 未套用時，設定編輯會被停用並顯示載入失敗，
不會退回缺少版本檢查的直接更新方式。

設定發布：

- 以載入時的設定作為基準，發布前逐項顯示「原設定 → 新設定」，涵蓋公告、開關、
  時間、題目文字／選項／必填與順序。沒有變更時不發布。
- 畫面持續提示未儲存變更；切換管理分頁保留草稿，站內路由切換與瀏覽器返回／前進
  使用路由阻擋確認，重新整理／關閉使用瀏覽器原生離開提醒；登出也會要求確認。
  草稿只保留於目前頁面的記憶體，不是自動存檔；確認離開後不保留。
- 表單、成績及題目開始時間須早於結束時間；成績／題目與表單區間完全不相交會阻擋。
  序位公告晚於表單結束則顯示提醒，允許管理員有意這樣設定。
- 編輯時間一律按台北時間解讀，與管理員電腦所在時區無關。載入備份會完整還原草稿，
  包括清除該版本未設定的時間，不會因空值而保留上一版的時間。
- 每 30 秒及頁面回到前景時檢查線上版本，發布前再確認一次；真正寫入時由 RPC
  在交易內鎖定設定列並比較 ID／revision，版本不同回傳衝突，不覆寫。
  衝突時可捨棄草稿載入線上版本，或保留草稿、改以最新版作為基準重新比較，
  後者仍須再次確認發布，不會自動合併同欄位的修改。
- 發布 RPC 使用呼叫者權限及原有管理員 RLS，不提升資料庫權限。版本觸發器會忽略
  呼叫者提供的 revision 並自動遞增；直接維護資料庫也會讓已開啟的新版前端察覺版本變更。
  舊版前端及特權直接寫入仍不會執行新版的比較流程，因此請同步更新所有管理介面，
  管理維護時也應避免刻意繞過版本比較。這不是防止管理員惡意寫入的功能。
- 最近三筆設定備份由伺服器產生時間與內容，前端不可透過發布 RPC 偽造備份欄位。

總覽：今日新增、符合篩選的有效樣本、各區樣本量、含今日的近七日趨勢（缺少資料日補 0）
及已發布表單的開放／關閉／尚未開始／已結束狀態。數量套用共用篩選；表單狀態不套用
資料篩選，按重新載入更新並顯示檢查時間。有效樣本目前定義為五科完整且選項合法；
有提供序位者還需比率 0–100、最小值不大於最大值及正整數序位區間。此數字並不代表
已驗證身分、Email 所有權或填答真實性。

匯出：

- 可全選／取消欄位，至少選一欄；仍只匯出目前已套用的共用篩選，包含所有符合的頁面。
- Email 預設以 `***@***` 取代，須勾選「包含完整 Email（個資）」才傳回與匯出原值；
  每次開啟匯出視窗都恢復遮蔽。選欄與遮蔽在資料庫 RPC 回傳前執行，瀏覽器也有相同防護。
- 自訂回答仍可能包含個資，遮蔽 Email 不代表整份檔案已去識別化。這是減少誤匯出的
  介面預設，不限制具原始填答讀取權限的管理員透過其他授權查詢存取資料。
- 保留 CSV 公式防護、台北時間、零值，以及 005 的游標分批匯出與取消功能。

本次驗證使用隔離資料庫與攔截外部請求的瀏覽器；未連線正式環境：

```text
node --test tests/admin-settings.test.mjs tests/spreadsheet-injection.test.mjs tests/submission-client.test.mjs tests/survey-config.test.mjs
node tests/admin-settings-access.cjs <已安裝的 @electric-sql/pglite 套件絕對路徑>
node tests/admin-settings-browser.cjs <已安裝的 playwright 套件絕對路徑>
```

瀏覽器測試沿用 005 的假 Supabase 設定與本機 Vite，涵蓋兩個管理頁面的衝突、確認畫面
開啟後再發生的更新、重新比較、捨棄草稿、未儲存提醒、洛杉磯瀏覽器時區下的台北時間、
欄位選擇、預設遮蔽與個資選項重設。新增資料庫測試同時涵蓋從 005 升級、重跑、
空設定表的建立衝突、RLS、版本觸發器、時間驗證、統計與遮蔽回傳。

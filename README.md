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

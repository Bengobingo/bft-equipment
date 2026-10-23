# BFT 設備借用管理系統

繁體中文、響應式的設備協作網站。React 19 / Vinext / TypeScript，後端運行於 Cloudflare Workers，資料持久保存於 D1；不是只存瀏覽器的展示頁。

## 功能

- 儀錶板：資產、可借設備、借用中與待我簽核計數，7 / 30 / 90 天趨勢、待辦與分類分布。
- 設備：新增與編輯、分類、唯一資產編號、品牌型號、序號、存放位置、配件備註、維護與停用、搜尋與卡片檢視。
- 借還：按設備及日期提出申請，檢查重疊預約與逾期未還設備，核准後領用點交，歸還必填檢查紀錄。
- 簽核：核准、填寫原因駁回、申請人取消、簽核歷程；主管不能簽核自己的申請。
- 成員：四層角色、部門、啟用停用、重設臨時密碼；首次登入強制改密碼。
- 帳號：修改顯示名稱、聯絡電子郵件、帳號及密碼；變更前驗證目前密碼，撤銷其他登入。
- 統計、CSV 匯出（含 Excel 相容 BOM 與公式注入防護）、通知中心、逾期提醒、操作紀錄。
- 行動裝置：收合導覽、設備與借還卡片列、鍵盤可操作的原生對話框與減少動態效果支援。

## 權限

| 角色       | 資料範圍                               | 可執行操作                                 |
| ---------- | -------------------------------------- | ------------------------------------------ |
| 一般使用者 | 自己的借用及相關操作紀錄；共用設備清單 | 提出與取消個人申請、修改個人帳密           |
| 簽核主管   | 同部門及自己的借用                     | 審核同部門其他人申請                       |
| 設備管理員 | 全公司借還與設備                       | 管理設備、領用與歸還點交                   |
| 系統管理員 | 全部資料                               | 成員與系統設定、跨部門簽核、設備及借還管理 |

上述權限均由伺服器檢查。系統管理員亦不能自行核准自己的借用。
部門存於申請當下，調整人員部門不會改寫歷史申請歸屬。

## 第一次使用

開啟網站後，自行建立第一個管理員帳號與密碼。沒有公開或固定的預設帳密。
密碼至少 12 個字元，包含英文字母及數字。可選擇空白開始，或載入 12 台設備、4 位停用成員及 11 筆範例借還。
範例不是公司的真實資產，頁尾標示「含範例資料」。啟用範例人員前須設定臨時密碼。

新網站發布時保留 Sites 的私人、僅擁有者存取設定，外層 ChatGPT 驗證仍保留；系統內另有使用者帳密與 RBAC。
新增系統內帳號不會自動更改網站分享權限。欲讓團隊上線使用，需另行設定網站存取對象。
通知目前顯示於網站內，未連接外部 Email、簡訊或企業 SSO。

## 本機啟動

需 Node.js 22.13 以上（建議 24），在專案目錄執行：

```powershell
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_far_cyclops.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_powerful_eternity.sql
npm run dev -- --hostname 127.0.0.1
```

只在新的本機資料庫套用上述 SQL 一次；既有資料庫僅依序套用尚未執行的 migration。
預覽網址為終端列出的 loopback URL（通常 http://127.0.0.1:5173）。
本機資料在忽略追蹤的 `.wrangler/state/`，與正式資料庫分開；請勿刪除正在使用的資料目錄。
若 Windows 的 `npm.cmd` 在自動化環境找錯路徑，可直接 `node scripts/run-framework.mjs build` 或 `node scripts/run-framework.mjs dev --hostname 127.0.0.1`。

## 驗證

```powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
node scripts/test-api.mjs
```

API 整合測試僅接受 loopback 位置與尚未初始化的測試資料庫，會建立本機測試帳號與設備；不要對既有工作資料庫執行。
涵蓋初始化、四層權限、跨部門隔離、首次改密碼、CSRF、唯一編號、日期、重複預約、完整狀態流程、禁止自行簽核、撤銷登入、停用與登入限流。
`scripts/qa-browser.mjs` 使用 taste-skill 的獨立測試瀏覽器；需設定 `BFT_TASTE_ROOT`，並以隱藏 stdin 提供本機測試帳密。畫面與檢查報告位於忽略追蹤的 `.taste-skill/qa/`。

## 資料與安全設計

密碼採每人獨立隨機 salt 的 PBKDF2-SHA256（100,000 次）；伺服器只存 session token 的 SHA256，Cookie 為 HttpOnly / SameSite=Lax，HTTPS 加 Secure，8 小時有效。
登入失敗 10 次將限流 15 分鐘。寫入檢查 Origin、JSON 類型與大小；SQL 使用參數化陳述式。
預約檢查與新增在同一 SQL 陳述式執行，狀態轉移含前置狀態條件；關鍵寫入與操作紀錄同批次提交。

`db/schema.ts` 是資料結構來源；SQL 與 metadata 在 `drizzle/`。
部署使用 `.openai/hosting.json` 的既有 project_id 與 D1 binding，Sites 在正式部署時套用 migrations。
操作紀錄畫面顯示權限範圍內最近 200 筆，資料庫仍保留更早紀錄。

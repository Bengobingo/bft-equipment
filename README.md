# HOU BFT 設備箱出借管理系統

**HOU BFT Equipment Box Lending Management System**

供伺服器系統廠／板廠管理設備箱，以整箱為單位借出，支援申請、跨部門簽核、零件點交及歸還。介面支援繁體中文／English、深色／淺色及手機。

## 本機使用

安裝 Node.js **22.13 以上**（建議 24），下載專案並在專案目錄執行：

```powershell
npm start
```

Windows 也可雙擊 **啟動設備管理.cmd**。首次啟動會安裝缺少的套件、建置、套用資料庫 migrations，再啟動 [本機網站](http://127.0.0.1:3000)。首次下載套件需要網路；字型隨套件提供。

第一次使用請建立管理員；沒有預設帳密。若要空白開始，不要勾選載入示範資料。密碼長度為 6–128 字元。

```powershell
npm run stop:local
npm run backup:local
```

備份前須先停止系統。資料位於 `data/`，不隨 Git 上傳；下載專案會建立自己的本機資料庫。預設只監聽 `127.0.0.1`，不開放區域網路連線；本機與原雲端資料不會自動同步。

## 簡易操作

1. 在「設備箱清單」選擇可用設備箱，填寫日期、站別及用途並送出申請。
2. PED 工程人員或系統管理員在「PED 簽核中心」跨部門核准／駁回。核准以綠色、駁回以紅色區分；駁回須填寫原因。任何角色都不能簽核自己的申請。
3. 核准後，在借用期間由工程人員或系統管理員逐項核對零件，辦理「點交借出」。
4. 借用人可在「我的借用設備箱」、借還清單或詳情按「歸還清點」，確認數量、狀況及檢查紀錄後歸還。缺件或損壞會將設備箱轉為待維護／補件。

側邊欄的 **？操作說明** 可隨時開啟四步驟說明。頁尾提供 TE／admin 聯絡提示。

## 主要功能

- 「設備箱清單」管理名稱、平台、保管位置、狀態及箱內零件。已借出時申請按鈕反灰，後端亦拒絕申請；歸還後恢復，其他預約與狀態限制仍適用。
- 零件欄位為類別、名稱、規格、料號 P/N、數量；名稱與規格分開，加寬規格欄位。移除零件序號輸入，既有序號及歷史快照保留。
- 零件類別：CPU、Memory、Motherboard、Storage、PCIe/Expansion、Network、Power、Cable、Heatsink、Other。新選單不再提供 DIMM／U.2；既有類別資料仍可查看、儲存及改選新類別。
- 「我的借用設備箱」只列出本人尚未歸還的設備箱，支援詳情、零件快照、歸還與匯出。
- 申請編號獨立顯示於第一欄，格式為 `BRyyMMddHHmm`，依申請建立時間及 `Asia/Taipei` 計算。例如 `BR2608111750` 代表 2026/08/11 17:50。
- 同一分鐘的申請會顯示相同編號；內部仍以各自 UUID 識別，顯示編號並非唯一鍵。舊申請亦依原建立時間顯示新格式。
- 提出申請時保存零件快照；有未結束申請時鎖定清單，後續編輯不改寫歷史快照。
- 儀錶板、通知、逾期提醒、操作紀錄及 CSV 匯出；中英文介面統一使用 Box 用語。

## 成員權限

| 角色 | 主要權限 |
| --- | --- |
| 產線操作人員 | 申請、查看與取消自己的申請；歸還自己的借用設備箱 |
| PED 工程人員 | 跨部門核准／駁回其他人的申請；設備箱與零件管理、維護／停用、領用歸還及檢查紀錄 |
| 系統管理員 | 全部管理權限，包含成員、系統設定及跨部門簽核 |

權限由伺服器檢查。一般使用者不能歸還他人的設備箱；工程人員與管理員可辦理點交。任何角色均不得核准或駁回自己的申請。

## 2026-10-27 更新

更新系統名稱與中英文用語、設備箱清單、獨立規格欄位及零件類別；新增本人借用頁面與本人歸還；阻擋已借出設備箱的新申請；開放工程人員跨部門簽核；新增核准／駁回選項與綠紅配色、時間格式申請編號、問號操作說明及聯絡提示。

## 開發與驗證

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
npm run build
node scripts/test-request-number.mjs
node scripts/test-role-migration.mjs
node scripts/test-password-kit-policy.mjs
```

API 整合測試必須使用**未初始化的獨立測試資料庫**，不能對工作資料庫執行。在第一個終端啟動隔離站台：

```powershell
node scripts/local-start.mjs --port 3001 --data-dir outputs/api-qa
```

在第二個 PowerShell 終端執行：

```powershell
$env:BFT_TEST_URL = "http://127.0.0.1:3001"
node scripts/test-api.mjs
```

測試涵蓋跨部門核准／駁回、自行簽核拒絕、本人歸還與他人權限、零件規格及快照、借出後拒絕新申請及歸還後恢復、清單鎖定與既有借還流程。測試輸出含測試帳密，請勿當作正式帳號或公開散布。

## English overview

Manage equipment boxes through request, cross-department review, itemized issue and return. The app runs locally with a SQLite-compatible database, bilingual UI, light/dark themes and CSV export.

- Engineers and administrators may approve or reject requests from any department, except their own requests.
- Borrowers may return their own boxes after completing the component checklist and inspection note.
- Boxes already on loan cannot be requested again until returned.
- Components have separate name and specification fields, P/N and quantity. Existing serial data is preserved.
- Request numbers use `BRyyMMddHHmm` in Taipei time; UUIDs remain the unique internal identifiers.
- Open the sidebar **? Quick guide** for the four-step workflow. Contact TE or admin for help.

## 文件與技術

- [完整功能、權限與開發說明](README-BFT.md)
- [一般使用者本機操作說明](本機使用說明.md)
- [底層 Starter 技術文件](README-STARTER.md)

React 19、TypeScript、Vinext、Cloudflare Worker runtime 與本機 D1 相容 SQLite。原「PED 設備箱管理員」帳號升級後會轉為 PED 工程人員；帳號、部門及歷史紀錄保留，依新版角色權限可跨部門簽核。

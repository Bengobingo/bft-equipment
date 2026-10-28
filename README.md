# HOU BFT 設備箱出借管理系統

**HOU BFT Equipment Box Lending Management System**

供伺服器系統廠／板廠管理設備箱，以整箱為單位借出，支援申請、跨部門簽核、零件點交及歸還。介面支援繁體中文／English、深色／淺色及手機。

## 本機使用

安裝 Node.js **22.13 以上**（建議 24），下載專案並在專案目錄執行：

```powershell
npm start
```

Windows 也可雙擊 **START system.cmd**。首次啟動會安裝缺少的套件、建置、套用資料庫 migrations，再啟動 [本機網站](http://127.0.0.1:3000)。首次下載套件需要網路；字型隨套件提供。

第一次使用請建立管理員；沒有預設帳密。若要空白開始，不要勾選載入示範資料。密碼長度為 6–128 字元。

```powershell
npm run stop:local
npm run backup:local
```

備份前須先停止系統。資料位於 `data/`，不隨 Git 上傳；下載專案會建立自己的本機資料庫。命令列 `npm start` 預設只監聽 `127.0.0.1`；`START system.cmd` 與 `npm run start:lan` 使用區域網模式，可讓其他裝置連線。本機與原雲端資料不會自動同步。


## 公司區域網使用 / Company LAN access

在這台主機執行 **START system.cmd**，或執行 `npm run start:lan`（等同 `node scripts/local-start.mjs --lan`）。區域網模式監聽 `0.0.0.0:3000`，啟動時列出目前 IPv4 網址；主機本身仍可使用 `http://127.0.0.1:3000`。

請使用啟動視窗顯示的主機區網 IP（以下以 `HOST_LAN_IP` 表示），同仁從公司區域網開啟 `http://<HOST_LAN_IP>:3000`，使用各自帳號登入。所有裝置共用主機上的 `data/state/`，同仁不需要安裝 Node.js 或複製資料庫。主機須保持開機且系統持續執行；IP 改變時請使用新的網址。

Windows 防火牆需允許公司網路對此主機 TCP 3000 的輸入連線。 可在系統管理員 PowerShell 執行 `powershell -File scripts/enable-lan-firewall.ps1 -IPAddress "HOST_LAN_IP"`，建立僅允許此 IP、本機網段、Domain／Private 設定檔的規則。建議僅允許公司網路設定檔與所需內網網段，不要關閉防火牆。請先將 `HOST_LAN_IP` 替換為主機實際的區網 IP；若同仁位於不同網段，需依公司網路規則調整允許的來源範圍。請勿將實際 IP 或網段提交至公開儲存庫。

登入、角色權限及同來源驗證保持啟用，區域網模式不會允許跨網站 API 請求。此版本使用 HTTP，請限於可信任的公司內網使用；若要長期提供服務，可由 IT 配置內部 HTTPS 網址。

Start **START system.cmd** or run `npm run start:lan` on the host. Colleagues can open `http://<HOST_LAN_IP>:3000` from the company LAN and sign in with their own accounts. The host must remain powered on and running; all clients use its existing database. Permit inbound TCP 3000 only from the required company network through Windows Firewall. Stop and back up the system on the host, using the existing stop and backup commands.

## 簡易操作

1. 在「設備箱清單」選擇可用設備箱，填寫日期、站別及用途並送出申請。
2. PED 工程人員或系統管理員在「PED 簽核中心」跨部門核准／駁回。核准以綠色、駁回以紅色區分；駁回須填寫原因。任何角色都不能簽核自己的申請。
3. 核准後，在借用期間由工程人員或系統管理員逐項核對零件，辦理「點交借出」。
4. 借用人在「我的借用設備箱」、清單或詳情按「申請歸還」，逐項自檢設備數量與狀況齊全正常、確認箱號與站別後送出，設備箱維持占用並進入「待歸還驗收」。
5. 另一位工程人員或管理員實際收到箱子，完成零件數量與狀況清點、填寫紀錄後，才能驗收歸還。缺件或損壞轉為維護／補件；誤送或未交回可填寫原因退回申請。

側邊欄的 **？操作說明** 可隨時開啟五步驟說明。頁尾提供 TE／admin 聯絡提示。

## 主要功能

- 「設備箱清單」管理名稱、機種名稱（Machine id）、保管位置、狀態及箱內零件。設備箱類別提供主機板測試設備箱與其他工程設備箱。已借出時申請按鈕反灰，後端亦拒絕申請；歸還後恢復，其他預約與狀態限制仍適用。
- 零件欄位為類別、名稱、規格、料號 P/N、數量；名稱與規格分開，加寬規格欄位。移除零件序號輸入，既有序號及歷史快照保留。
- 零件類別：CPU、Memory、Motherboard、Storage、PCIe/Expansion、Network、Power、Cable、Heatsink、Other。新選單不再提供 DIMM／U.2；既有類別資料仍可查看、儲存及改選新類別。
- 「我的借用設備箱」只列出本人尚未歸還的設備箱，支援詳情、零件快照、申請歸還與匯出。
- 申請編號獨立顯示於第一欄，格式為 `BRyyMMddHHmm`，依申請建立時間及 `Asia/Taipei` 計算。例如 `BR2608111750` 代表 2026/08/11 17:50。
- 同一分鐘的申請會顯示相同編號；內部仍以各自 UUID 識別，顯示編號並非唯一鍵。舊申請亦依原建立時間顯示新格式。
- 提出申請時保存零件快照；有未結束申請時鎖定清單，後續編輯不改寫歷史快照。
- 儀錶板、通知、逾期提醒、操作紀錄及 CSV 匯出；中英文介面統一使用 Box 用語。

## 批量點交領出 / Batch issue

工程人員或系統管理員可到「產線借還管理 → 待點交借出」，選擇「批量點交領出」。一般操作員無此權限。

1. 選擇同一借用人的申請（可跨不同站別），勾選或全選可領用設備箱，每批最多 50 箱。
2. 展開各箱的申請時零件快照，實際核對料號、數量與狀況後，逐箱勾選確認；異常箱可先移除。
3. 填寫一次共同備註，按「確認領出」。僅在核准的借用期間內、設備正常且未借出時才會成功。
4. 系統列出逐箱成功／失敗及原因。成功箱保留原申請，可獨立歸還；重試同批次會略過已成功項目。

Engineers and administrators can select **Production loans → Ready to issue → Batch issue boxes**. Select up to 50 boxes for the same borrower, including different fixtures, inspect and confirm each box, optionally add one shared note, then issue them together. Results are reported per box. Successful boxes remain independently returnable, and retrying the same batch does not issue them twice.

伺服器逐箱重新檢查權限、申請狀態、最後更新時間、日期與設備可用性。每箱更新、點交紀錄及批次結果以單一交易寫入；個別失敗不撤回其他成功箱。批次編號使用 UUID，與可重複的分鐘格式申請編號分開。網路中斷可在原視窗重試同一批次。批次、操作人員、時間與逐箱結果存於資料庫，借用詳情顯示所屬領出批次。

新增 migration `0006_batch_checkout.sql`，啟動時自動套用。建議先停止系統並執行 `npm run backup:local`。原有單箱點交與逐箱歸還仍可使用。


## 歸還申請與工程驗收 / Return inspection

使用中 → 借用人申請歸還 → 待歸還驗收 → 另一位工程人員／管理員驗收 → 已歸還。

- 一般使用者只有「申請歸還」權限；包含工程人員與管理員在內的所有借用人，均不能驗收自己的歸還。
- 申請需完成箱內設備逐項自檢（名稱、規格、料號、數量、狀況），每項均勾選確認且數量齊全、狀況正常，再勾選箱號／站別確認；自檢有異常時阻擋送出並提示聯絡工程人員或管理員。自檢結果獨立保存在每次歸還申請，工程驗收仍需重新實際清點；驗收需逐項清點、確認已實際收件並填寫檢查紀錄。
- 待驗收期間仍占用設備箱，禁止重新申請、領出、替換清單或改為維護；借用人可查看進度，工程待辦列出可處理的歸還申請。
- 正常驗收恢復可申請；已收到但缺件／損壞仍完成歸還，設備箱轉維護／補件。未交回或誤送可填寫原因退回，恢復使用中。
- 每次申請、申請說明、處理人與時間、退回或驗收結果均保存在歸還歷程。申請時間與最終實際驗收時間分開記錄；申請不會停止未歸還的占用或逾期計算。
- Migration `0008_return_self_check.sql` 新增可為空值的自檢欄位，既有申請保留為「未留存自檢紀錄」，不改寫歷史資料。
- 新增 migration `0007_return_inspection.sql`，保留既有申請與歷史歸還資料。每筆借用同時只允許一筆待驗收申請；過期頁面、重複送出或同時驗收會被攔截。

Borrowers select **Request return**, self-check every component and quantity, confirm everything is complete and working, then confirm the box/fixture. Missing, damaged, unchecked or mismatched items block submission in both the UI and API. Self-check results are retained per request and shown to inspectors. Historical requests keep their original records; loans without a manifest require a physical self-check note. The box remains occupied as **Awaiting return inspection**. Another engineer or administrator must confirm physical receipt, inspect every component and record a note before accepting it. Declining an undelivered request restores the loan; accepting missing/damaged components routes the box to maintenance. Complete return-request history is retained, and self-inspection is forbidden for every role.

Validation: `node scripts/test-notifications.mjs`, `node scripts/test-return-migration.mjs`, and the isolated API integration suite cover these rules.

## 成員權限

| 角色 | 主要權限 |
| --- | --- |
| 產線操作人員 | 申請、查看與取消自己的申請；提出自己的設備箱歸還申請 |
| PED 工程人員 | 跨部門核准／駁回其他人的申請；設備箱與零件管理、維護／停用、領用與他人歸還驗收及檢查紀錄 |
| 系統管理員 | 全部管理權限，包含成員、系統設定及跨部門簽核 |

權限由伺服器檢查。僅借用人能申請歸還，最終驗收與退回必須由另一位工程人員或管理員處理。任何角色都不得簽核自己的借用或驗收自己的歸還。

## 2026-10-28 更新

- 設備箱改用 BOX 流水編號、調整類別與 Machine id 欄位；一般操作員使用本人記錄查詢。
- 新增同借用人跨站別批量點交（每批最多 50 箱）、待簽核／待領出筆數及角色待辦提醒。
- 歸還改為借用人逐項自檢與申請，再由另一位工程人員或管理員實際驗收；保留申請、自檢、退回與驗收歷程。
- 支援公司 LAN 連線，修正 Windows 啟動檔並保留 CRLF。公開說明僅使用 `HOST_LAN_IP` 提示詞，實際網路位址與資料庫不納入 Git。
- 隔離 API 整合測試通過 875 項檢查；另驗證遷移、批量點交、BOX 編碼、通知及 HTTP LAN 的客戶端 ID 相容性。

## 2026-10-27 更新

更新系統名稱與中英文用語、設備箱清單、獨立規格欄位及零件類別；新增本人借用頁面與本人歸還；阻擋已借出設備箱的新申請；開放工程人員跨部門簽核；新增核准／駁回選項與綠紅配色、時間格式申請編號、問號操作說明及聯絡提示。

## 開發與驗證

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
npm run build
node scripts/test-box-codes.mjs
node scripts/test-batch-migration.mjs
node scripts/test-client-id.mjs
node scripts/test-notifications.mjs
node scripts/test-return-migration.mjs
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

測試涵蓋 50 箱批量領出、部分失敗與重試、同批次重送、兩批次競爭、逐箱歸還、角色與日期限制，以及跨部門核准／駁回、自行簽核拒絕、本人歸還與他人權限、零件規格及快照、借出後拒絕新申請及歸還後恢復、清單鎖定與既有借還流程。測試輸出含測試帳密，請勿當作正式帳號或公開散布。

## English overview

Manage equipment boxes through request, cross-department review, itemized issue and return. The app runs locally with a SQLite-compatible database, bilingual UI, light/dark themes and CSV export.

- Engineers and administrators may approve or reject requests from any department, except their own requests.
- Borrowers request a return. Another engineer or administrator must physically receive and inspect the box before completing it.
- Boxes already on loan cannot be requested again until returned.
- Components have separate name and specification fields, P/N and quantity. Existing serial data is preserved.
- Request numbers use `BRyyMMddHHmm` in Taipei time; UUIDs remain the unique internal identifiers.
- Open the sidebar **? Quick guide** for the five-step workflow. Contact TE or admin for help.

## 文件與技術

- [完整功能、權限與開發說明](README-BFT.md)
- [一般使用者本機操作說明](本機使用說明.md)
- [底層 Starter 技術文件](README-STARTER.md)

React 19、TypeScript、Vinext、Cloudflare Worker runtime 與本機 D1 相容 SQLite。原「PED 設備箱管理員」帳號升級後會轉為 PED 工程人員；帳號、部門及歷史紀錄保留，依新版角色權限可跨部門簽核。

一般操作員使用「記錄查詢」查看自己的完整申請與歷史，分頁為「全部紀錄」及各狀態，不再重複顯示「我的申請」。PED 工程人員與系統管理員維持「產線借還管理」，包含全廠申請及「我的申請」篩選。「我的借用設備箱」另作為本人尚未歸還設備箱的快捷入口。英文名稱分別為 Record lookup 與 Production loans。

設備箱自動編號為 `BOX001`、`BOX002`、`BOX003`，新增時接續現有 BOX 最大號碼。升級會將舊 PED 數字編號及數字型示範編號依原順序轉為 BOX 編號；若已有 BOX 編號則接續分配以避免衝突。設備箱 ID、借用關聯與自訂非自動編號保留。超過 999 後接續 `BOX1000`。

設備箱類別選單僅保留「主機板測試設備箱／Mainboard test box」與「其他工程設備箱／Other engineering box」；既有其他分類仍保留歷史資料，編輯時預設選為其他工程設備箱。原「對應平台／機種」欄位改稱「機種名稱／Machine id」，清單、設備箱詳情及設備匯出同步更新標示，既有欄位資料保留。

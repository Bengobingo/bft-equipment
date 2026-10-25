// Only system-authored text is translated; names and production notes remain as entered.
const english: Record<string, string> = {
  "PED 工程人員": "PED engineer",
  "找不到設備箱": "Kit not found.",
  "系統已完成初始化": "This system has already been initialized.",
  "請由帳號設定修改自己的資料；無法變更自己的權限": "Update your own profile in Account settings. You cannot change your own role.",
  "用途符合借用規範": "Production use approved",
  "取消本次借用": "Request cancelled",
  "設備與配件點交完成": "Kit and components verified at issue",
  "12 台設備、4 位停用的範例人員與 11 筆借還紀錄": "12 demo kits, 4 disabled demo operators and 11 loan records",
  "產線操作人員": "Production operator", "PED 簽核工程師": "PED reviewer", "PED 設備箱管理員": "PED kit custodian", "PED 系統管理員": "PED administrator",
  "一般使用者": "User", "簽核主管": "Reviewer", "設備管理員": "Custodian", "系統管理員": "Administrator",
  "啟用": "Enabled", "停用": "Disabled", "重設密碼": "Password reset",
  "請先登入系統": "Please sign in first.",
  "請先至帳號設定更新臨時密碼": "Replace your temporary password in Account settings first.",
  "帳號或密碼不正確，或帳號已停用": "Incorrect username or password, or this account is disabled.",
  "登入失敗次數過多，請於 15 分鐘後重試": "Too many sign-in attempts. Try again in 15 minutes.",
  "目前密碼不正確": "Your current password is incorrect.",
  "請設定新的密碼": "Please set a new password.",
  "密碼需為 6–128 字元": "Use a password of 6–128 characters.",
  "帳號需為 3–40 字元的英文字母、數字、點、底線或連字號": "Use a 3–40 character username with letters, numbers, dots, underscores or hyphens.",
  "電子郵件格式不正確": "Enter a valid email address.",
  "設備狀態不正確": "Invalid kit condition.",
  "設備箱需包含 1–80 項零件": "A kit must contain 1–80 component entries.",
  "零件資料格式不正確": "Invalid component data.",
  "零件識別碼不可重複": "Component IDs must be unique.",
  "零件類別不正確": "Invalid component type.",
  "零件數量必須為 1–10000 的整數": "Component quantity must be an integer from 1 to 10,000.",
  "請逐項完成全部零件的點交清單": "Check every component in the handover checklist.",
  "點交清單格式不正確": "Invalid handover checklist.",
  "點交數量或零件狀況不正確": "Invalid checked quantity or component condition.",
  "數量不足時請標示缺件或損壞": "Mark shortages as missing or damaged.",
  "借出前須確認全部零件齊全且正常": "All components must be complete and in good condition before issue.",
  "設備箱尚未建立零件清單，請先由 PED 完成建檔。": "PED must register this kit's manifest before it can be requested.",
  "資料已被變更、設備時段衝突或操作條件不符，請重新整理後再試": "This action conflicts with the current state. Active requests also lock kit contents and prevent maintenance. Refresh and review the request.",
  "此設備已移除、停用或維護中，請重新選擇設備。": "This kit is unavailable, retired or under maintenance. Choose another kit.",
  "此設備的借用時段已被預約，或有逾期未歸還的借用。待簽核申請也會保留時段，請調整日期或選擇其他設備。": "This kit is reserved for these dates or has an overdue loan. Pending requests also reserve dates. Choose other dates or another kit.",
  "日期格式不正確": "Enter valid dates.",
  "借用日期不得早於今天，歸還日期不得早於借用日期": "The start date cannot be in the past and the end date cannot precede it.",
  "僅同部門工程人員或系統管理員可簽核，且不得簽核自己的申請": "Only a PED engineer in the same department or an administrator can approve or reject. You cannot review your own request.",
  "申請尚未核准或已完成領用，無法借出": "Only approved requests can be issued.",
  "只能在核准的借用期間辦理領用": "Issue is only allowed within the approved borrowing period.",
  "僅工程人員或系統管理員可辦理領用": "Only PED engineers or administrators can issue kits.",
  "僅工程人員或系統管理員可辦理歸還": "Only PED engineers or administrators can receive returns.",
  "請填寫歸還檢查紀錄": "Enter a return inspection note.",
  "請填寫駁回原因": "Enter a reason for rejection.",
  "找不到申請": "Request not found.",
  "沒有取消此申請的權限": "You cannot cancel this request.",
  "沒有設備管理權限": "You do not have kit management permission.",
  "僅系統管理員可管理使用者": "Only administrators can manage members.",
  "僅系統管理員可變更設定": "Only administrators can change system settings.",
  "僅系統管理員可載入範例": "Only administrators can load demo data.",
  "權限角色不正確": "Invalid role.",
  "找不到使用者": "Member not found.",
  "請至帳號設定變更自己的資料": "Use Account settings to change your own details.",
  "啟用狀態不正確": "Invalid account status.",
  "啟用範例成員前，請先設定臨時密碼": "Set a temporary password before activating a demo member.",
  "最長借用天數為 1–90 天": "The borrowing limit must be 1–90 days.",
  "來源驗證失敗，請由本網站操作": "Origin verification failed. Use this website to continue.",
  "僅接受 JSON 請求": "Only JSON requests are accepted.",
  "請求內容過大": "The submitted data is too large.",
  "表單內容無法解析": "The submitted form could not be parsed.",
  "表單格式不正確": "Invalid form data.",
  "已有設備資料，無法載入範例": "Demo data is only available for an empty inventory.",
  "系統已初始化": "The system has already been initialized.",
  "資料庫尚未連接，請先完成資料庫設定": "The database is unavailable.",
  "帳號或設備編號已存在，或系統已初始化，請更換後再試": "The username or kit code already exists, or setup is complete.",
  "找不到操作": "Action not found.",
  "找不到此功能": "Endpoint not found.",
  "系統暫時無法處理，請稍後再試": "The system could not complete this action. Please try again.",
  "不可從此處變更自己的權限，請至帳號設定": "Use Account settings to update your own account.",
  "初始化系統": "System initialized",
  "建立第一位系統管理員": "First administrator created",
  "登入系統": "Signed in",
  "帳號登入成功": "Account signed in",
  "更新帳號資料": "Account updated",
  "更新個人資料與密碼，撤銷其他登入": "Profile and password updated; other sessions revoked",
  "更新個人資料，撤銷其他登入": "Profile updated; other sessions revoked",
  "新增設備": "Kit registered",
  "更新設備": "Kit updated",
  "提出借用申請": "Production request submitted",
  "核准借用申請": "Request approved",
  "駁回借用申請": "Request rejected",
  "取消借用申請": "Request cancelled",
  "辦理設備領用": "Kit issued",
  "完成設備歸還": "Kit returned",
  "設備已領用": "Kit issued",
  "借用申請已核准": "Request approved",
  "新增使用者": "Member created",
  "更新使用者權限": "Member permissions updated",
  "更新系統設定": "System settings updated",
  "載入範例資料": "Demo data loaded",
  "範例：用途符合設備借用規範": "Demo: production use approved",
  "範例：配件齊全，檢查正常": "Demo: complete and inspected"
};
export function translateSystem(message: string, locale?: string | null): string {
  if (!locale?.startsWith("en")) return message;
  if (english[message]) return english[message];
  const pieces = message.split("・");
  if (pieces.length > 1 && pieces.slice(1).every(piece => english[piece])) return [pieces[0], ...pieces.slice(1).map(piece => english[piece])].join(" · ");
  const setting = message.match(/^最長借用 (\d+) 天$/);
  if (setting) return `Maximum borrowing period: ${setting[1]} days`;
  const own = message.match(/^你已有此設備的借用申請（(.+)～(.+)，(.+)），/);
  const statuses: Record<string, string> = { "待簽核": "pending approval", "待領用": "approved", "借用中": "issued" };
  if (own) return `You already have a request for this kit (${own[1]} to ${own[2]}, ${statuses[own[3]] || own[3]}). Open the original request instead of submitting again.`;
  const limit = message.match(/^借用最長為 (\d+) 天$/);
  if (limit) return `The maximum borrowing period is ${limit[1]} days.`;
  const field = message.match(/^(.+) 為必填，且不得超過 (\d+) 字元$/);
  if (field) return `${field[1]} is required and must not exceed ${field[2]} characters.`;
  const required = message.match(/^請填寫 (.+)$/);
  if (required) return `Please enter ${required[1]}.`;
  return message;
}

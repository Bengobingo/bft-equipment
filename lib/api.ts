import { env } from "cloudflare:workers";
import { digest, hashPassword, randomToken, verifyPassword } from "./security";
import { roles, statusNames, taipeiDate, canReviewLoans, canManageEquipment, partTypes, legacyPartTypes, type User, type Loan, type ReturnRequest, type KitPart, type PartCheck } from "./types";
import { sampleEquipment, sampleParts } from "./seed";
import { translateSystem } from "./messages";

const safeColumns =
  "id,username,name,email,department,role,active,must_change,created";
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: { code: string; loanId?: string },
  ) {
    super(message);
  }
}
function assert(value: unknown, message: string, status = 400): asserts value {
  if (!value) throw new ApiError(message, status);
}
function text(
  b: Record<string, unknown>,
  key: string,
  max = 150,
  optional = false,
) {
  const v = b[key];
  assert(typeof v === "string", `請填寫 ${key}`);
  const s = v.trim();
  assert(
    (optional || s.length > 0) && s.length <= max,
    `${key} 為必填，且不得超過 ${max} 字元`,
  );
  return s;
}
function username(b: Record<string, unknown>) {
  const s = text(b, "username", 40).toLowerCase();
  assert(
    /^[a-z0-9][a-z0-9._-]{2,39}$/.test(s),
    "帳號需為 3–40 字元的英文字母、數字、點、底線或連字號",
  );
  return s;
}
function passwordText(b: Record<string, unknown>, key: string) {
  const value = b[key];
  assert(typeof value === "string" && value.length > 0 && value.length <= 128, "密碼需為 6–128 字元");
  return value;
}
function email(b: Record<string, unknown>) {
  const s = text(b, "email", 254, true);
  assert(!s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "電子郵件格式不正確");
  return s;
}
function db() {
  assert(env.DB, "資料庫尚未連接，請先完成資料庫設定", 503);
  return env.DB;
}
function statement(sql: string, args: unknown[] = []) {
  return db()
    .prepare(sql)
    .bind(...args);
}
async function first<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) {
  return statement(sql, args).first<T>();
}
async function all<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) {
  return (await statement(sql, args).all<T>()).results;
}
function event(actor: string, action: string, target: string, detail: string) {
  return statement(
    "INSERT INTO events (id,actor_id,action,target,detail,created) VALUES (?,?,?,?,?,?)",
    [id(), actor, action, target, detail, now()],
  );
}
async function logged(
  sql: string,
  args: unknown[],
  actor: User,
  action: string,
  target: string,
  detail: string,
  onConflict?: () => Promise<never>,
  after: D1PreparedStatement[] = [],
) {
  const result = await db().batch([
    statement(sql, args),
    statement(
      "INSERT INTO events (id,actor_id,action,target,detail,created) SELECT ?,?,?,?,?,? WHERE changes() > 0",
      [id(), actor.id, action, target, detail, now()],
    ),
    ...after,
  ]);
  if (result[0].meta.changes !== 1 && onConflict) await onConflict();
  assert(
    result[0].meta.changes === 1,
    "資料已被變更、設備時段衝突或操作條件不符，請重新整理後再試",
    409,
  );
}
function cookie(req: Request, token: string, age = 28800) {
  return `bft_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
function sessionToken(req: Request) {
  return (
    req.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)bft_session=([a-f0-9]{64})/)?.[1] || ""
  );
}
async function identity(req: Request) {
  const t = sessionToken(req);
  if (!t) return null;
  return first<User & { password: string }>(
    `SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1`,
    [await digest(t), Date.now()],
  );
}
async function newSession(userId: string, req: Request) {
  const t = randomToken();
  await statement("DELETE FROM sessions WHERE expires < ?", [Date.now()]).run();
  await statement(
    "INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)",
    [await digest(t), userId, Date.now() + 28800000],
  ).run();
  return cookie(req, t);
}
async function config() {
  const rows = await all<{ key: string; value: string }>(
    "SELECT * FROM settings",
  );
  const o = Object.fromEntries(rows.map((x) => [x.key, x.value]));
  return {
    organization: o.organization || "BFT PED",
    maxDays: Number(o.maxDays || 30),
    sample: o.sample === "true",
  };
}
function list<T>(value: unknown): T[] {
  return typeof value === "string" ? JSON.parse(value) : Array.isArray(value) ? value : [];
}
function componentInput(value: unknown): KitPart[] {
  assert(Array.isArray(value) && value.length >= 1 && value.length <= 80, "設備箱需包含 1–80 項零件");
  const seen = new Set<string>();
  return value.map((raw) => {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), "零件資料格式不正確");
    const part = raw as Record<string, unknown>;
    const partId = text(part, "id", 80);
    assert(!seen.has(partId), "零件識別碼不可重複");
    seen.add(partId);
    assert([...partTypes, ...legacyPartTypes].includes(part.type as KitPart["type"]), "零件類別不正確");
    assert(Number.isInteger(part.quantity) && Number(part.quantity) >= 1 && Number(part.quantity) <= 10000, "零件數量必須為 1–10000 的整數");
    const specification = text({ specification: "", ...part }, "specification", 100, true);
    return { id: partId, type: part.type as KitPart["type"], name: text(part, "name", 100), partNumber: text(part, "partNumber", 100, true), serial: text({ serial: "", ...part }, "serial", 100, true), quantity: Number(part.quantity), ...(specification ? { specification } : {}) };
  });
}
function checklistInput(value: unknown, manifest: KitPart[], action: "checkout" | "return"): PartCheck[] {
  if (!manifest.length) return []; // Historical loans created before kit manifests remain operable.
  assert(Array.isArray(value) && value.length === manifest.length, "請逐項完成全部零件的點交清單");
  const expected = new Map(manifest.map((part) => [part.id, part]));
  const seen = new Set<string>();
  return value.map((raw) => {
    assert(raw && typeof raw === "object", "點交清單格式不正確");
    const row = raw as PartCheck;
    const part = expected.get(row.id);
    assert(part && !seen.has(row.id) && row.checked === true, "請逐項完成全部零件的點交清單");
    seen.add(row.id);
    assert(["ok", "damaged", "missing"].includes(row.condition) && Number.isInteger(row.quantity) && row.quantity >= 0 && row.quantity <= part.quantity, "點交數量或零件狀況不正確");
    assert(row.quantity === part.quantity || row.condition !== "ok", "數量不足時請標示缺件或損壞");
    if (action === "checkout") assert(row.quantity === part.quantity && row.condition === "ok", "借出前須確認全部零件齊全且正常");
    return { id: row.id, quantity: row.quantity, condition: row.condition, checked: true };
  });
}
function equipmentInput(input: Record<string, unknown>, defaults?: { code: string; brand: string; serial: string }) {
  const b = { brand: "", serial: "", ...defaults, ...input };
  const condition = text(b, "condition");
  assert(
    ["ready", "maintenance", "retired"].includes(condition),
    "設備狀態不正確",
  );
  return [
    b.code === undefined ? null : text(b, "code", 40),
    text(b, "name", 100),
    text(b, "category", 30),
    text(b, "brand", 50, true),
    text(b, "model", 100, true),
    text(b, "serial", 100, true),
    text(b, "location", 100),
    condition,
    text(b, "notes", 1000, true),
  ];
}
type BatchItem = { loanId: string; expectedUpdated: string; confirmed: boolean };
async function batchCheckout(actor: User, body: Record<string, unknown>, locale: string | null) {
  assert(canManageEquipment(actor), "僅工程人員或系統管理員可辦理領用", 403);
  const batchId = text(body, "batchId", 80);
  const note = text({ note: "", ...body }, "note", 1000, true);
  assert(Array.isArray(body.items) && body.items.length >= 1 && body.items.length <= 50, "每批請選擇 1 至 50 個設備箱");
  const items: BatchItem[] = body.items.map(raw => {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), "批量領出資料格式不正確");
    const item = raw as Record<string, unknown>;
    assert(typeof item.confirmed === "boolean", "請確認各箱零件齊全且正常");
    return { loanId: text(item, "loanId", 80), expectedUpdated: text(item, "expectedUpdated", 40), confirmed: item.confirmed };
  }).sort((a, b) => a.loanId.localeCompare(b.loanId));
  assert(new Set(items.map(item => item.loanId)).size === items.length, "同一筆申請不可重複選取");
  const loans = await Promise.all(items.map(item => first<Loan>("SELECT * FROM loans WHERE id=?", [item.loanId])));
  const valid = loans.filter((loan): loan is Loan => !!loan);
  assert(valid.length > 0, "找不到申請", 404);
  assert(valid.every(loan => loan.user_id === valid[0].user_id), "同一批須為相同借用人");
  assert(new Set(valid.map(loan => loan.equipment_id)).size === valid.length, "同一批不可包含相同設備箱的多筆申請");
  // Legacy batch summary is empty for mixed fixtures; each loan retains its own fixture.
  const fixture = valid.every(loan => loan.production_line === valid[0].production_line) ? valid[0].production_line : "";
  const payload = JSON.stringify({ note, items });
  await statement("INSERT INTO checkout_batches(id,actor_id,borrower_id,production_line,payload,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", [batchId, actor.id, valid[0].user_id, fixture, payload, now()]).run();
  const batch = await first<{ actor_id: string; payload: string }>("SELECT actor_id,payload FROM checkout_batches WHERE id=?", [batchId]);
  assert(batch?.actor_id === actor.id && batch.payload === payload, "批次識別碼已使用，請重新開啟批量領出", 409);
  const results: { loanId: string; status: "success" | "failed"; error?: string }[] = [];
  for (const item of items) {
    const saved = await first<{ status: string }>("SELECT status FROM checkout_batch_items WHERE batch_id=? AND loan_id=?", [batchId, item.loanId]);
    if (saved?.status === "success") { results.push({ loanId: item.loanId, status: "success" }); continue; }
    try {
      const loan = await first<Loan>("SELECT * FROM loans WHERE id=?", [item.loanId]);
      assert(loan, "找不到申請", 404);
      assert(item.confirmed, "請確認各箱零件齊全且正常");
      assert(loan.status === "approved", "申請尚未核准或已完成領用，無法借出", 409);
      assert(loan.updated === item.expectedUpdated, "申請內容已變更，請重新選取設備箱", 409);
      const today = taipeiDate();
      assert(loan.start <= today && loan.end >= today, "只能在核准的借用期間辦理領用");
      const manifest = list<KitPart>(loan.manifest);
      assert(manifest.length > 0, "此申請沒有零件快照，請改用單箱點交");
      const checks = checklistInput(manifest.map(part => ({ id: part.id, quantity: part.quantity, checked: true, condition: "ok" })), manifest, "checkout");
      const stamp = now();
      await db().batch([
        statement("UPDATE loans SET status='borrowed',checked_out=?,updated=?,checkout_check=?,checkout_batch_id=? WHERE id=? AND status='approved' AND updated=? AND EXISTS(SELECT 1 FROM equipment WHERE id=? AND condition='ready') AND NOT EXISTS(SELECT 1 FROM loans WHERE equipment_id=? AND status IN ('borrowed','return_pending'))", [stamp, stamp, JSON.stringify(checks), batchId, loan.id, item.expectedUpdated, loan.equipment_id, loan.equipment_id]),
        statement("INSERT INTO events(id,actor_id,action,target,detail,created) SELECT ?,?,?,?,?,? WHERE changes()>0", [id(), actor.id, "辦理設備領用", loan.id, `批次 ${batchId} · ${note || "設備與配件點交完成"}`, stamp]),
        statement("INSERT INTO checkout_batch_items(batch_id,loan_id,status,error,updated) SELECT ?,?,'success','',? FROM loans WHERE id=? AND checkout_batch_id=? ON CONFLICT(batch_id,loan_id) DO UPDATE SET status='success',error='',updated=excluded.updated", [batchId, loan.id, stamp, loan.id, batchId]),
      ]);
      const success = await first<{ status: string }>("SELECT status FROM checkout_batch_items WHERE batch_id=? AND loan_id=?", [batchId, loan.id]);
      assert(success?.status === "success", "設備箱狀態已變更或已借出，請重新整理", 409);
      results.push({ loanId: item.loanId, status: "success" });
    } catch (error) {
      // Another identical submission may have completed while this attempt was validating.
      const completed = await first<{ status: string }>("SELECT status FROM checkout_batch_items WHERE batch_id=? AND loan_id=?", [batchId, item.loanId]);
      if (completed?.status === "success") { results.push({ loanId: item.loanId, status: "success" }); continue; }
      if (!(error instanceof ApiError)) throw error;
      await statement("INSERT INTO checkout_batch_items(batch_id,loan_id,status,error,updated) VALUES(?,?,'failed',?,?) ON CONFLICT(batch_id,loan_id) DO UPDATE SET error=excluded.error,updated=excluded.updated WHERE checkout_batch_items.status!='success'", [batchId, item.loanId, error.message, now()]).run();
      const outcome = await first<{ status: string; error: string }>("SELECT status,error FROM checkout_batch_items WHERE batch_id=? AND loan_id=?", [batchId, item.loanId]);
      results.push(outcome?.status === "success" ? { loanId: item.loanId, status: "success" } : { loanId: item.loanId, status: "failed", error: translateSystem(outcome?.error || error.message, locale) });
    }
  }
  return { ok: true, batchId, results, succeeded: results.filter(row => row.status === "success").length, failed: results.filter(row => row.status === "failed").length };
}

async function state(u: User) {
  const restricted =
    u.role === "employee" ? "WHERE l.user_id=?" : "";
  const args =
    u.role === "employee" ? [u.id] : [];
  const [equipment, loans, users, events, settings, returnRequests] = await Promise.all([
    all(
      `SELECT e.*,EXISTS(SELECT 1 FROM loans l WHERE l.equipment_id=e.id AND l.status IN ('borrowed','return_pending')) AS busy,EXISTS(SELECT 1 FROM loans l WHERE l.equipment_id=e.id AND l.status='return_pending') AS awaiting_return,EXISTS(SELECT 1 FROM loans l WHERE l.equipment_id=e.id AND l.status='approved') AS awaiting_issue,EXISTS(SELECT 1 FROM loans l WHERE l.equipment_id=e.id AND l.status IN ('pending','approved') AND l.start<=? AND l.end>=?) AS reserved FROM equipment e ORDER BY e.code`,
      [taipeiDate(), taipeiDate()],
    ),
    all(
      `SELECT l.*,e.name AS equipment_name,e.code,e.category,u.name AS user_name,a.name AS approver_name FROM loans l JOIN equipment e ON e.id=l.equipment_id JOIN users u ON u.id=l.user_id LEFT JOIN users a ON a.id=l.approver_id ${restricted} ORDER BY l.created DESC`,
      args,
    ),
    u.role === "admin"
      ? all(`SELECT ${safeColumns} FROM users ORDER BY created`)
      : Promise.resolve([]),
    all(
      `SELECT ev.*,u.name AS actor_name FROM events ev JOIN users u ON u.id=ev.actor_id ${canManageEquipment(u) ? "" : `WHERE ev.actor_id=? OR ev.target IN (SELECT l.id FROM loans l ${restricted})`} ORDER BY ev.created DESC LIMIT 200`,
      canManageEquipment(u) ? [] : [u.id, ...args],
    ),
    config(),
    all<ReturnRequest>(`SELECT rr.*,q.name AS requester_name,v.name AS reviewer_name FROM return_requests rr JOIN loans l ON l.id=rr.loan_id JOIN users q ON q.id=rr.requester_id LEFT JOIN users v ON v.id=rr.reviewer_id ${restricted} ORDER BY rr.rowid`, args),
  ]);
  const returnHistory = new Map<string, ReturnRequest[]>();
  for (const request of returnRequests) {
    const history = returnHistory.get(request.loan_id) || [];
    history.push({ ...request, self_check: request.self_check === null ? null : list<PartCheck>(request.self_check) }); returnHistory.set(request.loan_id, history);
  }
  const safe = Object.fromEntries(
    safeColumns
      .split(",")
      .map((k) => [k, (u as unknown as Record<string, unknown>)[k]]),
  );
  return {
    user: safe,
    equipment: equipment.map((row) => ({ ...row, components: list<KitPart>(row.components) })),
    loans: loans.map((row) => ({ ...row, manifest: list<KitPart>(row.manifest), checkout_check: list<PartCheck>(row.checkout_check), return_check: list<PartCheck>(row.return_check), return_requests: returnHistory.get(String(row.id)) || [] })),
    users,
    events,
    settings: {
      organization: settings.organization,
      maxDays: settings.maxDays,
    },
    sample: settings.sample,
  };
}
async function seed(actor: User) {
  assert(
    !(await first("SELECT id FROM equipment LIMIT 1")),
    "已有設備資料，無法載入範例",
    409,
  );
  const batch: D1PreparedStatement[] = [];
  const equipmentIds = sampleEquipment.map(() => id());
  sampleEquipment.forEach((x, i) =>
    batch.push(
      statement(
        "INSERT INTO equipment (id,code,name,category,brand,model,serial,location,condition,notes,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [equipmentIds[i], ...x, now()],
      ),
    ),
  );
  equipmentIds.forEach((equipmentId, i) => batch.push(statement(
    "UPDATE equipment SET components=? WHERE id=?", [JSON.stringify(sampleParts(i)), equipmentId],
  )));
  const people = [
    ["林育萱", "Production A"],
    ["陳冠宇", "Production B"],
    ["王雅婷", "Production A"],
    ["黃柏翰", "Production C"],
  ];
  const peopleIds = people.map(() => id());
  people.forEach((p, i) =>
    batch.push(
      statement(
        "INSERT INTO users (id,username,name,email,department,role,password,active,must_change,created) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          peopleIds[i],
          `sample.${i + 1}`,
          p[0],
          "",
          p[1],
          "employee",
          "",
          0,
          1,
          now(),
        ],
      ),
    ),
  );
  const day = (offset: number) =>
    taipeiDate(new Date(Date.now() + offset * 86400000));
  const rows = [
    [0, 0, -2, 3, "borrowed", "Server mainboard functional test"],
    [1, 2, 1, 3, "pending", "CPU / DIMM production validation"],
    [2, 1, 0, 1, "approved", "U.2 storage qualification"],
    [3, 3, -5, -1, "borrowed", "Server thermal verification"],
    [4, 0, 2, 4, "pending", "Production cable continuity test"],
    [5, 1, -6, -3, "returned", "New production line setup"],
    [7, 2, -3, 2, "borrowed", "Mainboard power-on test"],
    [8, 3, 3, 5, "pending", "Server system pilot build"],
    [9, 0, -12, -10, "returned", "DIMM stress screening"],
    [10, 2, -17, -15, "returned", "PED fixture verification"],
    [11, 3, -22, -20, "returned", "Production rework validation"],
  ];
  for (const [ei, pi, start, end, status, purpose] of rows) {
    const loanId = id();
    const created = new Date(
      Date.now() + (Number(start) - 2) * 86400000,
    ).toISOString();
    batch.push(
      statement(
        "INSERT INTO loans (id,equipment_id,user_id,department,start,end,purpose,status,created,updated,approver_id,decision_note,checked_out,returned,return_note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          loanId,
          equipmentIds[Number(ei)],
          peopleIds[Number(pi)],
          people[Number(pi)][1],
          day(Number(start)),
          day(Number(end)),
          purpose,
          status,
          created,
          created,
          status === "pending" ? null : actor.id,
          status === "pending" ? "" : "範例：用途符合設備借用規範",
          ["borrowed", "returned"].includes(String(status))
            ? day(Number(start)) + "T01:00:00Z"
            : null,
          status === "returned" ? day(Number(end)) + "T09:00:00Z" : null,
          status === "returned" ? "範例：配件齊全，檢查正常" : "",
        ],
      ),
    );
    batch.push(statement(
      "UPDATE loans SET production_line=?,work_order=?,product_model=?,manifest=(SELECT components FROM equipment WHERE id=equipment_id) WHERE id=?",
      ["SMT-" + (Number(pi) + 1), "DEMO-WO-" + String(Number(ei) + 1).padStart(4, "0"), "Server Validation / DEMO", loanId],
    ));
    batch.push(
      statement(
        "INSERT INTO events (id,actor_id,action,target,detail,created) VALUES (?,?,?,?,?,?)",
        [
          id(),
          peopleIds[Number(pi)],
          status === "pending"
            ? "提出借用申請"
            : status === "borrowed"
              ? "設備已領用"
              : status === "returned"
                ? "完成設備歸還"
                : "借用申請已核准",
          loanId,
          `${sampleEquipment[Number(ei)][1]}（範例資料）`,
          created,
        ],
      ),
    );
  }
  batch.push(
    statement(
      "INSERT INTO settings (key,value) VALUES ('sample','true') ON CONFLICT(key) DO UPDATE SET value='true'",
    ),
    event(
      actor.id,
      "載入範例資料",
      "system",
      "12 台設備、4 位停用的範例人員與 11 筆借還紀錄",
    ),
  );
  await db().batch(batch);
}
export async function handle(req: Request) {
  try {
    const path = new URL(req.url).pathname.replace("/api/", "");
    const method = req.method;
    let b: Record<string, unknown> = {};
    if (method !== "GET") {
      // Drain bounded request bodies before rejecting them. Leaving a body unread
      // can reset the next request on a reused local HTTP connection.
      const reader = req.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length >= 32768) {
              await reader.cancel();
              throw new ApiError("請求內容過大", 413);
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      assert(
        req.headers.get("origin") === new URL(req.url).origin,
        "來源驗證失敗，請由本網站操作",
        403,
      );
      assert(
        req.headers.get("content-type")?.includes("application/json"),
        "僅接受 JSON 請求",
        415,
      );
      assert(
        Number(req.headers.get("content-length") || 0) < 32768,
        "請求內容過大",
        413,
      );
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const raw = new TextDecoder().decode(bytes);
      try {
        b = JSON.parse(raw);
      } catch {
        throw new ApiError("表單內容無法解析");
      }
      assert(b && typeof b === "object" && !Array.isArray(b), "表單格式不正確");
    }
    if (path === "health" && method === "GET") {
      await first("SELECT key FROM settings LIMIT 1");
      return respond({
        application: "bft-equipment",
        status: "ok",
        instance: env.BFT_LOCAL_INSTANCE || null,
      });
    }
    if (path === "auth" && method === "GET") {
      const u = await identity(req);
      return respond({
        setup: !(await first("SELECT id FROM users LIMIT 1")),
        user: u
          ? Object.fromEntries(
              safeColumns
                .split(",")
                .map((k) => [k, (u as unknown as Record<string, unknown>)[k]]),
            )
          : null,
      });
    }
    if (path === "setup" && method === "POST") {
      assert(
        !(await first("SELECT id FROM users LIMIT 1")),
        "系統已完成初始化",
        409,
      );
      const userId = id(),
        stamp = now(),
        hash = await hashPassword(passwordText(b, "password"));
      const result = await db().batch([
        statement("INSERT INTO settings (key,value) VALUES ('initialized',?)", [
          userId,
        ]),
        statement(
          "INSERT INTO users (id,username,name,email,department,role,password,active,must_change,created) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            userId,
            username(b),
            text(b, "name", 60),
            email(b),
            text(b, "department", 60),
            "admin",
            hash,
            1,
            0,
            stamp,
          ],
        ),
        statement(
          "INSERT INTO settings (key,value) VALUES ('organization',?),('maxDays','30')",
          [text(b, "organization", 60)],
        ),
        event(userId, "初始化系統", "system", "建立第一位系統管理員"),
      ]);
      assert(result[1].meta.changes === 1, "系統已初始化", 409);
      const u = (await first<User>("SELECT * FROM users WHERE id=?", [
        userId,
      ]))!;
      if (b.sample === true) await seed(u);
      return respond(
        { ok: true },
        { "Set-Cookie": await newSession(userId, req) },
      );
    }
    if (path === "login" && method === "POST") {
      const login = username(b),
        key = await digest(
          `${req.headers.get("cf-connecting-ip") || "local"}:${login}`,
        ),
        attempt = await first<{ count: number; expires: number }>(
          "SELECT * FROM login_attempts WHERE key=?",
          [key],
        );
      assert(
        !attempt || attempt.expires < Date.now() || attempt.count < 10,
        "登入失敗次數過多，請於 15 分鐘後重試",
        429,
      );
      await statement(
        "INSERT INTO login_attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END",
        [key, Date.now() + 900000, Date.now(), Date.now()],
      ).run();
      const u = await first<User & { password: string }>(
        "SELECT * FROM users WHERE username=?",
        [login],
      );
      const ok = await verifyPassword(
        passwordText(b, "password"),
        u?.password || "0".repeat(64) + ":" + "0".repeat(64),
      );
      assert(u && u.active && ok, "帳號或密碼不正確，或帳號已停用", 401);
      await db().batch([
        statement("DELETE FROM login_attempts WHERE key=?", [key]),
        event(u.id, "登入系統", u.id, "帳號登入成功"),
      ]);
      return respond(
        { ok: true },
        { "Set-Cookie": await newSession(u.id, req) },
      );
    }
    const u = await identity(req);
    assert(u, "請先登入系統", 401);
    if (path === "logout" && method === "POST") {
      await statement("DELETE FROM sessions WHERE token=?", [
        await digest(sessionToken(req)),
      ]).run();
      return respond({ ok: true }, { "Set-Cookie": cookie(req, "", 0) });
    }
    if (u.must_change && path !== "account" && path !== "state")
      throw new ApiError("請先至帳號設定更新臨時密碼", 403);
    if (path === "state" && method === "GET") return respond(await state(u));
    if (path === "account" && method === "PUT") {
      assert(
        await verifyPassword(passwordText(b, "currentPassword"), u.password),
        "目前密碼不正確",
        403,
      );
      const pass = b.newPassword
        ? await hashPassword(passwordText(b, "newPassword"))
        : u.password;
      assert(!u.must_change || Boolean(b.newPassword), "請設定新的密碼");
      await db().batch([
        statement(
          "UPDATE users SET username=?,name=?,email=?,password=?,must_change=0 WHERE id=?",
          [username(b), text(b, "name", 60), email(b), pass, u.id],
        ),
        statement("DELETE FROM sessions WHERE user_id=?", [u.id]),
        event(
          u.id,
          "更新帳號資料",
          u.id,
          b.newPassword
            ? "更新個人資料與密碼，撤銷其他登入"
            : "更新個人資料，撤銷其他登入",
        ),
      ]);
      return respond(
        { ok: true },
        { "Set-Cookie": await newSession(u.id, req) },
      );
    }
    if (path === "equipment" && method === "POST") {
      assert(canManageEquipment(u), "沒有設備管理權限", 403);
      const equipmentId = id();
      await db().batch([
        statement(
          "INSERT INTO equipment (id,code,name,category,brand,model,serial,location,condition,notes,created,components) SELECT ?,COALESCE(?,(SELECT printf('BOX%03d',COALESCE(MAX(CAST(SUBSTR(code,4) AS INTEGER)),0)+1) FROM equipment WHERE code GLOB 'BOX[0-9]*' AND SUBSTR(code,4) NOT GLOB '*[^0-9]*')),?,?,?,?,?,?,?,?,?,?",
          [equipmentId, ...equipmentInput(b), now(), JSON.stringify(componentInput(b.components))],
        ),
        event(u.id, "新增設備", equipmentId, String(b.name)),
      ]);
      return respond({ ok: true });
    }
    if (path.startsWith("equipment/") && method === "PUT") {
      assert(canManageEquipment(u), "沒有設備管理權限", 403);
      const target = path.split("/")[1];
      const existing = await first<{ code: string; brand: string; serial: string }>("SELECT code,brand,serial FROM equipment WHERE id=?", [target]);
      assert(existing, "找不到設備箱", 404);
      const values = equipmentInput(b, existing);
      const components = b.components === undefined ? null : JSON.stringify(componentInput(b.components));
      await logged(
        "UPDATE equipment SET code=?,name=?,category=?,brand=?,model=?,serial=?,location=?,condition=?,notes=?,components=COALESCE(?,components) WHERE id=? AND (?='ready' OR NOT EXISTS (SELECT 1 FROM loans WHERE equipment_id=? AND status IN ('pending','approved','borrowed','return_pending'))) AND (? IS NULL OR ?=components OR NOT EXISTS(SELECT 1 FROM loans WHERE equipment_id=? AND status IN ('pending','approved','borrowed','return_pending')))",
        [...values, components, target, b.condition, target, components, components, target],
        u,
        "更新設備",
        target,
        String(b.name),
      );
      return respond({ ok: true });
    }
    if (path === "loans" && method === "POST") {
      const equipmentId = text(b, "equipment_id", 80),
        start = text(b, "start", 10),
        end = text(b, "end", 10),
        purpose = text(b, "purpose", 1000),
        productionLine = text(b, "production_line", 60),
        workOrder = text({ work_order: "", ...b }, "work_order", 80, true),
        productModel = text(b, "product_model", 100, true),
        settings = await config();
      assert(
        /^\d{4}-\d{2}-\d{2}$/.test(start) &&
          /^\d{4}-\d{2}-\d{2}$/.test(end) &&
          Number.isFinite(Date.parse(start)) &&
          Number.isFinite(Date.parse(end)) &&
          new Date(start).toISOString().startsWith(start) &&
          new Date(end).toISOString().startsWith(end),
        "日期格式不正確",
      );
      assert(
        start >= taipeiDate() && end >= start,
        "借用日期不得早於今天，歸還日期不得早於借用日期",
      );
      assert(
        (Date.parse(end) - Date.parse(start)) / 86400000 + 1 <=
          settings.maxDays,
        `借用最長為 ${settings.maxDays} 天`,
      );
      const target = id(),
        stamp = now();
      await logged(
        "INSERT INTO loans (id,equipment_id,user_id,department,start,end,purpose,status,created,updated,production_line,work_order,product_model,manifest) SELECT ?,?,?,?,?,?,?,'pending',?,?,?,?,?,components FROM equipment WHERE id=? AND condition='ready' AND components!='[]' AND NOT EXISTS(SELECT 1 FROM loans WHERE equipment_id=? AND status IN ('pending','approved','borrowed','return_pending') AND start<=? AND end>=?) AND NOT EXISTS(SELECT 1 FROM loans WHERE equipment_id=? AND status IN ('borrowed','return_pending'))",
        [
          target,
          equipmentId,
          u.id,
          u.department,
          start,
          end,
          purpose,
          stamp,
          stamp,
          productionLine,
          workOrder,
          productModel,
          equipmentId,
          equipmentId,
          end,
          start,
          equipmentId,
        ],
        u,
        "提出借用申請",
        target,
        purpose,
        async () => {
          // Diagnose only after the atomic insert fails; never weaken its guards.
          const own = await first<Loan>(
            "SELECT * FROM loans WHERE equipment_id=? AND user_id=? AND status IN ('pending','approved','borrowed','return_pending') AND ((start<=? AND end>=?) OR status IN ('borrowed','return_pending')) ORDER BY created DESC LIMIT 1",
            [equipmentId, u.id, end, start],
          );
          if (own)
            throw new ApiError(
              `你已有此設備的借用申請（${own.start}～${own.end}，${statusNames[own.status]}），請查看原申請，無需重複送出。`,
              409,
              { code: "own_reservation", loanId: own.id },
            );
          const equipment = await first<{ condition: string; components: string }>(
            "SELECT condition,components FROM equipment WHERE id=?",
            [equipmentId],
          );
          if (!equipment || equipment.condition !== "ready")
            throw new ApiError("此設備已移除、停用或維護中，請重新選擇設備。", 409,
              { code: "equipment_unavailable" });
          if (!list(equipment.components).length)
            throw new ApiError("設備箱尚未建立零件清單，請先由 PED 完成建檔。", 409, { code: "manifest_required" });
          const borrowed = await first<{ id: string }>("SELECT id FROM loans WHERE equipment_id=? AND status IN ('borrowed','return_pending') LIMIT 1", [equipmentId]);
          if (borrowed)
            throw new ApiError("設備箱已借出，歸還後才能申請。", 409, { code: "equipment_borrowed" });
          throw new ApiError(
            "此設備的借用時段已被預約，或有逾期未歸還的借用。待簽核申請也會保留時段，請調整日期或選擇其他設備。",
            409,
            { code: "reservation_conflict" },
          );
        },
      );
      return respond({ ok: true, id: target });
    }
    if (path === "loans/batch-checkout" && method === "POST")
      return respond(await batchCheckout(u, b, req.headers.get("accept-language")));
    if (path.startsWith("checkout-batches/") && method === "GET") {
      assert(canManageEquipment(u), "僅工程人員或系統管理員可辦理領用", 403);
      const batch = await first("SELECT id,actor_id,borrower_id,production_line,created FROM checkout_batches WHERE id=?", [path.slice("checkout-batches/".length)]);
      assert(batch, "找不到批次", 404);
      const rows = await all<{loan_id:string;status:string;error:string;updated:string;production_line:string}>("SELECT i.loan_id,i.status,i.error,i.updated,COALESCE(l.production_line,'') AS production_line FROM checkout_batch_items i LEFT JOIN loans l ON l.id=i.loan_id WHERE i.batch_id=? ORDER BY i.loan_id", [batch.id]);
      return respond({ ...batch, items: rows.map(row => ({ ...row, error: translateSystem(row.error, req.headers.get("accept-language")) })) });
    }
    if (path.startsWith("loans/") && method === "POST") {
      const [, target, action] = path.split("/");
      const l = await first<Loan>("SELECT * FROM loans WHERE id=?", [target]);
      assert(l, "找不到申請", 404);
      const note =
        typeof b.note === "string" ? text(b, "note", 1000, true) : "";
      const stamp = now();
      if (action === "approve" || action === "reject") {
        assert(
          canReviewLoans(u) && u.id !== l.user_id,
          "僅工程人員或系統管理員可簽核，且不得簽核自己的申請",
          403,
        );
        assert(action !== "reject" || note.length > 0, "請填寫駁回原因");
        await logged(
          "UPDATE loans SET status=?,approver_id=?,decision_note=?,updated=? WHERE id=? AND status='pending'",
          [
            action === "approve" ? "approved" : "rejected",
            u.id,
            note,
            stamp,
            target,
          ],
          u,
          action === "approve" ? "核准借用申請" : "駁回借用申請",
          target,
          note || "用途符合借用規範",
        );
      } else if (action === "cancel") {
        assert(
          u.id === l.user_id || u.role === "admin",
          "沒有取消此申請的權限",
          403,
        );
        await logged(
          "UPDATE loans SET status='cancelled',updated=? WHERE id=? AND status IN ('pending','approved')",
          [stamp, target],
          u,
          "取消借用申請",
          target,
          note || "取消本次借用",
        );
      } else if (action === "checkout") {
        assert(
          canManageEquipment(u),
          "僅工程人員或系統管理員可辦理領用",
          403,
        );
        assert(
          l.start <= taipeiDate() && l.end >= taipeiDate(),
          "只能在核准的借用期間辦理領用",
        );
        assert(l.status === "approved", "申請尚未核准或已完成領用，無法借出", 409);
        const checklist = checklistInput(b.checklist, list<KitPart>(l.manifest), "checkout");
        await logged(
          "UPDATE loans SET status='borrowed',checked_out=?,updated=?,checkout_check=? WHERE id=? AND status='approved' AND EXISTS(SELECT 1 FROM equipment WHERE id=? AND condition='ready') AND NOT EXISTS(SELECT 1 FROM loans WHERE equipment_id=? AND status IN ('borrowed','return_pending'))",
          [stamp, stamp, JSON.stringify(checklist), target, l.equipment_id, l.equipment_id],
          u,
          "辦理設備領用",
          target,
          note || "設備與配件點交完成",
        );
      } else if (action === "request-return") {
        assert(u.id === l.user_id, "僅借用人可申請歸還", 403);
        assert(l.status === "borrowed", "僅使用中的設備箱可申請歸還", 409);
        assert(b.confirmed === true, "請確認設備箱與站別後再送出歸還申請");
        const manifest = list<KitPart>(l.manifest);
        assert(manifest.length || note, "歷史借用沒有零件快照，請填寫實際設備自檢說明");
        const selfCheck = checklistInput(b.self_check, manifest, "return");
        assert(selfCheck.every(row => row.condition === "ok" && row.quantity === manifest.find(part => part.id === row.id)?.quantity), "自檢須確認全部設備數量齊全且狀況正常，異常請先聯絡工程人員或管理員");
        const requestId = id();
        await logged(
          "UPDATE loans SET status='return_pending',updated=? WHERE id=? AND status='borrowed'",
          [stamp, target], u, "提出歸還申請", target, note || "等待工程人員實際點收",
          undefined,
          [statement("INSERT INTO return_requests(id,loan_id,requester_id,requested,request_note,status,self_check) SELECT ?,?,?,?,?,'pending',? WHERE changes()>0", [requestId, target, u.id, stamp, note, JSON.stringify(selfCheck)])],
        );
      } else if (action === "return" || action === "reject-return") {
        assert(canManageEquipment(u) && u.id !== l.user_id, "須由其他工程人員或系統管理員驗收歸還", 403);
        assert(l.status === "return_pending", "請先由借用人申請歸還，再辦理驗收", 409);
        const pending = await first<{id:string}>("SELECT id FROM return_requests WHERE loan_id=? AND status='pending'", [target]);
        assert(pending && b.return_request_id === pending.id, "歸還申請已變更，請重新整理後再試", 409);
        assert(note, action === "return" ? "請填寫歸還檢查紀錄" : "請填寫退回歸還申請的原因");
        if (action === "reject-return") {
          await logged(
            "UPDATE loans SET status='borrowed',updated=? WHERE id=? AND status='return_pending' AND EXISTS(SELECT 1 FROM return_requests WHERE id=? AND loan_id=? AND status='pending')",
            [stamp, target, pending.id, target], u, "退回歸還申請", target, note, undefined,
            [statement("UPDATE return_requests SET status='rejected',reviewer_id=?,reviewed=?,review_note=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM loans WHERE id=? AND status='borrowed' AND updated=?)", [u.id, stamp, note, pending.id, target, stamp])],
          );
        } else {
          assert(b.received === true, "請確認已實際收到設備箱後再完成驗收");
          const checklist = checklistInput(b.checklist, list<KitPart>(l.manifest), "return");
          const issue = checklist.some(row => row.condition !== "ok");
          await logged(
            "UPDATE loans SET status='returned',returned=?,return_note=?,updated=?,return_check=? WHERE id=? AND status='return_pending' AND EXISTS(SELECT 1 FROM return_requests WHERE id=? AND loan_id=? AND status='pending')",
            [stamp, note, stamp, JSON.stringify(checklist), target, pending.id, target],
            u, "完成設備歸還", target, note, undefined,
            [statement("UPDATE return_requests SET status='accepted',reviewer_id=?,reviewed=?,review_note=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM loans WHERE id=? AND status='returned' AND returned=?)", [u.id, stamp, note, pending.id, target, stamp]),
             ...(issue ? [statement("UPDATE equipment SET condition='maintenance' WHERE id=? AND EXISTS(SELECT 1 FROM loans WHERE id=? AND status='returned' AND returned=?)", [l.equipment_id, target, stamp])] : [])],
          );
        }
      } else throw new ApiError("找不到操作", 404);
      return respond({ ok: true });
    }
    if (path === "users" && method === "POST") {
      assert(u.role === "admin", "僅系統管理員可管理使用者", 403);
      const role = text(b, "role");
      assert(Object.hasOwn(roles, role), "權限角色不正確");
      const target = id();
      await db().batch([
        statement(
          "INSERT INTO users (id,username,name,email,department,role,password,active,must_change,created) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            target,
            username(b),
            text(b, "name", 60),
            email(b),
            text(b, "department", 60),
            role,
            await hashPassword(passwordText(b, "password")),
            1,
            1,
            now(),
          ],
        ),
        event(
          u.id,
          "新增使用者",
          target,
          `${b.name}・${roles[role as keyof typeof roles]}`,
        ),
      ]);
      return respond({ ok: true });
    }
    if (path.startsWith("users/") && method === "PUT") {
      assert(u.role === "admin", "僅系統管理員可管理使用者", 403);
      const target = path.split("/")[1];
      assert(target !== u.id, "請由帳號設定修改自己的資料；無法變更自己的權限");
      const existing = await first<User & { password: string }>(
        "SELECT * FROM users WHERE id=?",
        [target],
      );
      assert(existing, "找不到使用者", 404);
      const role = text(b, "role");
      assert(Object.hasOwn(roles, role), "權限角色不正確");
      assert(b.active === 0 || b.active === 1, "啟用狀態不正確");
      assert(
        b.active !== 1 || existing.password || b.password,
        "啟用範例成員前，請先設定臨時密碼",
      );
      const password = b.password
        ? await hashPassword(passwordText(b, "password"))
        : null;
      await db().batch([
        statement(
          "UPDATE users SET name=?,email=?,department=?,role=?,active=?,password=COALESCE(?,password),must_change=CASE WHEN ? IS NULL THEN must_change ELSE 1 END WHERE id=?",
          [
            text(b, "name", 60),
            email(b),
            text(b, "department", 60),
            role,
            b.active,
            password,
            password,
            target,
          ],
        ),
        statement("DELETE FROM sessions WHERE user_id=?", [target]),
        event(
          u.id,
          "更新使用者權限",
          target,
          `${b.name}・${roles[role as keyof typeof roles]}・${b.active ? "啟用" : "停用"}${password ? "・重設密碼" : ""}`,
        ),
      ]);
      return respond({ ok: true });
    }
    if (path === "settings" && method === "PUT") {
      assert(u.role === "admin", "僅系統管理員可變更設定", 403);
      const days = Number(b.maxDays);
      assert(
        Number.isInteger(days) && days >= 1 && days <= 90,
        "最長借用天數為 1–90 天",
      );
      await db().batch([
        statement(
          "INSERT INTO settings (key,value) VALUES ('organization',?),('maxDays',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          [text(b, "organization", 60), String(days)],
        ),
        event(u.id, "更新系統設定", "system", `最長借用 ${days} 天`),
      ]);
      return respond({ ok: true });
    }
    if (path === "sample" && method === "POST") {
      assert(u.role === "admin", "僅系統管理員可載入範例", 403);
      await seed(u);
      return respond({ ok: true });
    }
    throw new ApiError("找不到此功能", 404);
  } catch (error) {
    if (error instanceof ApiError)
      return respond({ error: translateSystem(error.message, req.headers.get("accept-language")), ...error.details }, {}, error.status);
    if (error instanceof Error && /UNIQUE constraint/.test(error.message))
      return respond(
        { error: translateSystem("帳號或設備編號已存在，或系統已初始化，請更換後再試", req.headers.get("accept-language")) },
        {},
        409,
      );
    if (error instanceof Error && error.message.startsWith("密碼需為"))
      return respond({ error: translateSystem(error.message, req.headers.get("accept-language")) }, {}, 400);
    console.error(
      "API failure",
      error instanceof Error ? error.message : "unknown",
    );
    return respond({ error: translateSystem("系統暫時無法處理，請稍後再試", req.headers.get("accept-language")) }, {}, 500);
  }
}
function respond(
  data: unknown,
  headers: Record<string, string> = {},
  status = 200,
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

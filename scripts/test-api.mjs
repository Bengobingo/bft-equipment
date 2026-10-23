import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
const base = process.env.BFT_TEST_URL || "http://127.0.0.1:5173";
assert(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Tests may only mutate a loopback development database.",
);
const suffix = Date.now().toString(36),
  password = "BftQA-" + randomBytes(16).toString("hex"),
  newPassword = "BftNEW-" + randomBytes(16).toString("hex");
let checks = 0;
function client() {
  let cookie = "";
  return async (path, method = "GET", body, expected = 200, origin = base) => {
    const r = await fetch(base + "/api/" + path, {
      method,
      headers: {
        ...(method === "GET"
          ? {}
          : { Origin: origin, "Content-Type": "application/json" }),
        Cookie: cookie,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await r.text();
    let d;
    try {
      d = JSON.parse(raw);
    } catch {
      d = { error: raw };
    }
    assert.equal(r.status, expected, `${method} ${path}: ${JSON.stringify(d)}`);
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    checks++;
    return d;
  };
}
const admin = client(),
  anon = client();
const auth = await admin("auth");
assert(
  auth.setup,
  "Use a fresh local database for the full integration suite.",
);
await admin("setup", "POST", {
  username: "qa.admin",
  name: "測試管理員",
  email: "qa@example.test",
  department: "行政管理部",
  organization: "BFT 工作空間",
  password,
  sample: true,
});
await anon(
  "setup",
  "POST",
  {
    username: "duplicate",
    name: "重複管理員",
    email: "",
    department: "行政管理部",
    organization: "測試",
    password,
  },
  409,
);
let d = await admin("state");
assert.equal(d.equipment.length, 12);
assert.equal(d.loans.length, 11);
assert.equal(d.users.length, 5);
assert(d.sample);
assert(!JSON.stringify(d).includes("password"));
checks += 5;
await anon("state", "GET", undefined, 401);
await admin(
  "equipment",
  "POST",
  {
    code: "BAD-ORIGIN",
    name: "來源測試",
    category: "電腦設備",
    brand: "",
    model: "",
    serial: "",
    location: "測試",
    condition: "ready",
    notes: "",
  },
  403,
  "https://invalid.example",
);
const users = {};
for (const role of ["employee", "approver", "custodian"]) {
  const username = `qa.${role}.${suffix}`;
  await admin("users", "POST", {
    username,
    name: `測試${role}`,
    email: "",
    department: "測試部門",
    role,
    password,
  });
  users[role] = { username, call: client() };
  await users[role].call("login", "POST", { username, password });
  await users[role].call("loans", "POST", {}, 403);
  await users[role].call("account", "PUT", {
    username,
    name: `測試${role}`,
    email: "",
    currentPassword: password,
    newPassword,
  });
}
const employee = users.employee.call,
  approver = users.approver.call,
  custodian = users.custodian.call;
await employee("equipment", "POST", {}, 403);
await approver("users", "POST", {}, 403);
await custodian("settings", "PUT", {}, 403);
await admin(
  "users",
  "POST",
  {
    username: "qa.invalid",
    name: "錯誤角色",
    email: "",
    department: "測試",
    role: "toString",
    password,
  },
  400,
);
const testEquipment = {
  code: "QA-" + suffix,
  name: "流程測試筆電",
  category: "電腦設備",
  brand: "BFT",
  model: "QA",
  serial: suffix,
  location: "測試庫房",
  condition: "ready",
  notes: "測試充電器與保護套",
};
await admin("equipment", "POST", testEquipment);
await admin("equipment", "POST", testEquipment, 409);
d = await admin("state");
const eq = d.equipment.find((e) => e.code === testEquipment.code);
assert(eq);
checks++;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const loan = {
  equipment_id: eq.id,
  start: today,
  end: today,
  purpose: "整合測試：借用至歸還",
};
await employee("loans", "POST", { ...loan, end: "2026-02-30" }, 400);
await employee(
  "loans",
  "POST",
  { ...loan, start: "2000-01-01", end: "2000-01-02" },
  400,
);
const l = await employee("loans", "POST", loan);
await employee("loans", "POST", loan, 409);
d = await employee("state");
assert.equal(d.users.length, 0);
assert(d.loans.every((l) => l.user_id === d.user.id));
assert(d.loans.find((x) => x.id === l.id));
checks += 3;
await employee(`loans/${l.id}/approve`, "POST", {}, 403);
await custodian(`loans/${l.id}/approve`, "POST", {}, 403);
await custodian(`loans/${l.id}/checkout`, "POST", {}, 409);
await admin(
  "equipment/" + eq.id,
  "PUT",
  { ...testEquipment, condition: "maintenance" },
  409,
);
await approver(`loans/${l.id}/approve`, "POST", { note: "用途符合規範" });
await approver(`loans/${l.id}/approve`, "POST", {}, 409);
await employee(`loans/${l.id}/checkout`, "POST", {}, 403);
await custodian(`loans/${l.id}/checkout`, "POST", { note: "配件齊全" });
await employee(`loans/${l.id}/cancel`, "POST", {}, 409);
await custodian(`loans/${l.id}/return`, "POST", { note: "" }, 400);
await custodian(`loans/${l.id}/return`, "POST", { note: "設備正常，配件完整" });
d = await employee("state");
const returned = d.loans.find((x) => x.id === l.id);
assert.equal(returned.status, "returned");
assert.equal(returned.return_note, "設備正常，配件完整");
assert(returned.checked_out && returned.returned);
checks += 3;
await admin("equipment/" + eq.id, "PUT", {
  ...testEquipment,
  condition: "maintenance",
});
await employee("loans", "POST", loan, 409);
await admin("equipment/" + eq.id, "PUT", testEquipment);
const cancel = await employee("loans", "POST", loan);
await employee(`loans/${cancel.id}/cancel`, "POST", {});
const reject = await employee("loans", "POST", loan);
await approver(`loans/${reject.id}/reject`, "POST", { note: "" }, 400);
await approver(`loans/${reject.id}/reject`, "POST", { note: "需求尚未確認" });
const own = await approver("loans", "POST", loan);
await approver(`loans/${own.id}/approve`, "POST", {}, 403);
await admin(`loans/${own.id}/approve`, "POST", { note: "跨角色核准" });
await approver(`loans/${own.id}/cancel`, "POST", {});
const cross = client();
await admin("users", "POST", {
  username: `qa.other.${suffix}`,
  name: "其他部門主管",
  email: "",
  department: "其他部門",
  role: "approver",
  password,
});
await cross("login", "POST", { username: `qa.other.${suffix}`, password });
await cross("account", "PUT", {
  username: `qa.other.${suffix}`,
  name: "其他部門主管",
  email: "",
  currentPassword: password,
  newPassword,
});
const pending = await employee("loans", "POST", loan);
await cross(`loans/${pending.id}/approve`, "POST", {}, 403);
const crossData = await cross("state");
assert(!crossData.loans.some((l) => l.id === pending.id));
checks++;
await employee(`loans/${pending.id}/cancel`, "POST", {});
const stale = client();
await stale("login", "POST", {
  username: users.employee.username,
  password: newPassword,
});
await employee(
  "account",
  "PUT",
  {
    username: users.employee.username,
    name: "測試employee",
    email: "",
    currentPassword: "wrong",
    newPassword: password,
  },
  403,
);
await employee("account", "PUT", {
  username: users.employee.username,
  name: "測試employee",
  email: "",
  currentPassword: newPassword,
  newPassword: password,
});
await stale("state", "GET", undefined, 401);
await employee("logout", "POST", {});
await employee("state", "GET", undefined, 401);
await employee(
  "login",
  "POST",
  { username: users.employee.username, password: newPassword },
  401,
);
await employee("login", "POST", {
  username: users.employee.username,
  password,
});
d = await admin("state");
const member = d.users.find((x) => x.username === users.employee.username);
await admin("users/" + member.id, "PUT", {
  name: member.name,
  email: "",
  department: member.department,
  role: member.role,
  active: 0,
});
await employee("state", "GET", undefined, 401);
await employee("login", "POST", { username: member.username, password }, 401);
await admin(
  "settings",
  "PUT",
  { organization: "BFT 工作空間", maxDays: 91 },
  400,
);
await admin("settings", "PUT", { organization: "BFT 工作空間", maxDays: 30 });
for (let i = 0; i < 10; i++)
  await anon(
    "login",
    "POST",
    { username: "qa.notfound", password: "bad" },
    401,
  );
await anon("login", "POST", { username: "qa.notfound", password: "bad" }, 429);
d = await admin("state");
assert(d.events.some((e) => e.action === "完成設備歸還"));
assert(d.events.some((e) => e.action === "更新使用者權限"));
checks += 2;
console.log(
  JSON.stringify({
    ok: true,
    checks,
    localAdmin: { username: "qa.admin", password },
    summary:
      "Setup, RBAC, cross-department isolation, forced password change, CSRF, duplicate assets, invalid dates, overlapping reservations, approval state transitions, self-approval prevention, checkout, return, cancellation, rejection, session revocation, disabled users, CSV source data and rate limits passed.",
  }),
);

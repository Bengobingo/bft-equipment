import assert from "node:assert/strict";
import { randomBytes, randomInt } from "node:crypto";
const base = process.env.BFT_TEST_URL || "http://127.0.0.1:5173";
assert(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Tests may only mutate a loopback development database.",
);
const suffix = Date.now().toString(36),
  password = String(randomInt(100000, 1000000)),
  newPassword = randomBytes(3).toString("hex");
let checks = 0;
function client() {
  let cookie = "";
  return async (path, method = "GET", body, expected = 200, origin = base, language = "zh-TW") => {
    const r = await fetch(base + "/api/" + path, {
      method,
      headers: {
        ...(method === "GET"
          ? {}
          : { Origin: origin, "Content-Type": "application/json" }),
        Cookie: cookie,
        "Accept-Language": language,
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
    assert(
      (Array.isArray(expected) ? expected : [expected]).includes(r.status),
      `${method} ${path}: expected ${expected}, got ${r.status}: ${JSON.stringify(d)}`,
    );
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
for (const role of ["employee", "approver"]) {
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
  approver = users.approver.call;
await employee("equipment", "POST", {}, 403);
await approver("users", "POST", {}, 403);
await approver("settings", "PUT", {}, 403);
const retiredRole = { username: `qa.retired.${suffix}`, name: "Removed role", email: "", department: "測試部門", role: "custodian", password };
await admin("users", "POST", retiredRole, 400);
const operatorRecord = (await admin("state")).users.find(row => row.username === users.employee.username);
await admin(`users/${operatorRecord.id}`, "PUT", { ...operatorRecord, role: "custodian", active: 1 }, 400);
const roleState = await admin("state");
assert(!roleState.users.some(row => row.role === "custodian" || row.username === retiredRole.username));
assert.equal(roleState.users.find(row => row.id === operatorRecord.id).role, "employee");
checks += 2;
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
  name: "PED Server Validation Kit",
  category: "伺服器整機設備箱",
  brand: "BFT",
  model: "QA",
  serial: suffix,
  location: "測試庫房",
  condition: "ready",
  notes: "測試充電器與保護套",
  components: ["CPU", "DIMM", "Cable", "U.2", "Heatsink"].map((type, index) => ({ id: `qa-part-${index}`, type, name: `${type} validation component`, partNumber: `PN-${index}`, serial: `SN-${index}`, quantity: index === 1 ? 8 : 2 })),
};
await admin("equipment", "POST", testEquipment);
await admin("equipment", "POST", testEquipment, 409);
d = await admin("state");
const eq = d.equipment.find((e) => e.code === testEquipment.code);
assert(eq);
checks++;
// Simplified kit forms omit code, brand and kit serial; legacy values must survive edits.
const simplifiedKit = { ...testEquipment, name: "Simplified PED kit" };
delete simplifiedKit.code; delete simplifiedKit.brand; delete simplifiedKit.serial;
await admin(`equipment/${eq.id}`, "PUT", simplifiedKit);
const preserved = (await admin("state")).equipment.find(row => row.id === eq.id);
assert.equal(preserved.code, testEquipment.code);
assert.equal(preserved.brand, testEquipment.brand);
assert.equal(preserved.serial, testEquipment.serial);
checks += 3;
await Promise.all([
  admin("equipment", "POST", { ...simplifiedKit, name: "Auto numbered kit A" }),
  admin("equipment", "POST", { ...simplifiedKit, name: "Auto numbered kit B" }),
]);
const automaticKits = (await admin("state")).equipment.filter(row => row.name.startsWith("Auto numbered kit "));
assert.equal(automaticKits.length, 2);
assert.equal(new Set(automaticKits.map(row => row.code)).size, 2);
assert(automaticKits.every(row => /^PED-\d{4,}$/.test(row.code) && row.brand === "" && row.serial === ""));
assert.deepEqual(automaticKits.map(row => row.code).sort(), ["PED-0001", "PED-0002"]);
checks++;
checks += 3;
await admin(`equipment/${eq.id}`, "PUT", testEquipment);
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
  production_line: "FCT-02",
  product_model: "Server validation platform",
};
const checklist = testEquipment.components.map(part => ({ id: part.id, quantity: part.quantity, condition: "ok", checked: true }));
await employee("loans", "POST", { ...loan, production_line: "" }, 400);
await employee("loans", "POST", { ...loan, production_line: " ".repeat(2) }, 400);
await employee("loans", "POST", { ...loan, production_line: "F".repeat(61) }, 400);
await employee("loans", "POST", { ...loan, end: "2026-02-30" }, 400);
await employee(
  "loans",
  "POST",
  { ...loan, start: "2000-01-01", end: "2000-01-02" },
  400,
);
const l = await employee("loans", "POST", loan);
const duplicate = await employee("loans", "POST", loan, 409);
assert.equal(duplicate.code, "own_reservation");
assert.equal(duplicate.loanId, l.id);
assert.match(duplicate.error, /待簽核/);
checks += 3;
d = await employee("state");
assert.equal(d.users.length, 0);
assert(d.loans.every((l) => l.user_id === d.user.id));
assert(d.loans.find((x) => x.id === l.id));
assert.equal(d.loans.find((x) => x.id === l.id).production_line, "FCT-02");
assert.equal(d.loans.find((x) => x.id === l.id).work_order, "");
checks += 5;
await employee(`loans/${l.id}/approve`, "POST", {}, 403);
await approver(`loans/${l.id}/checkout`, "POST", {}, 409);
await admin(
  "equipment/" + eq.id,
  "PUT",
  { ...testEquipment, condition: "maintenance" },
  409,
);
await approver(`loans/${l.id}/approve`, "POST", { note: "用途符合規範" });
await approver(`loans/${l.id}/approve`, "POST", {}, 409);
await employee(`loans/${l.id}/checkout`, "POST", {}, 403);
await approver(`loans/${l.id}/checkout`, "POST", { note: "配件齊全" }, 400);
await approver(`loans/${l.id}/checkout`, "POST", { note: "配件齊全", checklist: checklist.slice(1) }, 400);
await approver(`loans/${l.id}/checkout`, "POST", { note: "配件齊全", checklist });
await employee(`loans/${l.id}/cancel`, "POST", {}, 409);
await approver(`loans/${l.id}/return`, "POST", { note: "" }, 400);
await approver(`loans/${l.id}/return`, "POST", { note: "設備正常，配件完整", checklist });
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
const unavailable = await employee("loans", "POST", loan, 409);
assert.equal(unavailable.code, "equipment_unavailable");
checks++;
await admin("equipment/" + eq.id, "PUT", testEquipment);
const cancel = await employee("loans", "POST", { ...loan, work_order: "WO-HISTORICAL-COMPATIBILITY" });
assert.equal((await employee("state")).loans.find(row => row.id === cancel.id).work_order, "WO-HISTORICAL-COMPATIBILITY");
checks++;
await employee(`loans/${cancel.id}/cancel`, "POST", {});
const reject = await employee("loans", "POST", loan);
await approver(`loans/${reject.id}/reject`, "POST", { note: "" }, 400);
await approver(`loans/${reject.id}/reject`, "POST", { note: "需求尚未確認" });
const own = await approver("loans", "POST", loan);
await approver(`loans/${own.id}/approve`, "POST", {}, 403);
await approver(`loans/${own.id}/reject`, "POST", { note: "不可自行簽核" }, 403);
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
await cross(`loans/${pending.id}/reject`, "POST", { note: "跨部門不可駁回" }, 403);
const crossData = await cross("state");
assert(crossData.loans.some((l) => l.id === pending.id)); // Visible for handovers, not cross-department approval.
checks++;
await employee(`loans/${pending.id}/cancel`, "POST", {});
// Admin borrowing must enter pending exactly once, even under concurrent submissions.
const beforeAdminLoan = await admin("state");
const raced = await Promise.all([
  admin("loans", "POST", { ...loan, purpose: "管理員借用測試" }, [200, 409]),
  admin("loans", "POST", { ...loan, purpose: "管理員借用測試" }, [200, 409]),
]);
assert.equal(raced.filter((r) => r.ok).length, 1);
const adminLoan = raced.find((r) => r.ok);
assert.equal(raced.find((r) => !r.ok).loanId, adminLoan.id);
const afterAdminLoan = await admin("state");
assert.equal(afterAdminLoan.loans.length, beforeAdminLoan.loans.length + 1);
assert.equal(afterAdminLoan.events.length, beforeAdminLoan.events.length + 1);
assert.equal(afterAdminLoan.loans.find((l) => l.id === adminLoan.id).status, "pending");
assert.equal(afterAdminLoan.loans.find((l) => l.id === adminLoan.id).user_id, afterAdminLoan.user.id);
checks += 6;
await admin(`loans/${adminLoan.id}/approve`, "POST", {}, 403);
await cross(`loans/${adminLoan.id}/approve`, "POST", {}, 403);
const otherConflict = await employee("loans", "POST", loan, 409);
assert.equal(otherConflict.code, "reservation_conflict");
assert(!otherConflict.loanId && !otherConflict.error.includes(adminLoan.id));
checks += 2;
const secondAdmin = client();
await admin("users", "POST", {
  username: `qa.admin2.${suffix}`, name: "第二管理員", email: "",
  department: "行政管理部", role: "admin", password,
});
await secondAdmin("login", "POST", { username: `qa.admin2.${suffix}`, password });
await secondAdmin("account", "PUT", {
  username: `qa.admin2.${suffix}`, name: "第二管理員", email: "",
  currentPassword: password, newPassword,
});
await secondAdmin(`loans/${adminLoan.id}/approve`, "POST", { note: "由另一位管理員簽核" });
assert.equal((await admin("state")).loans.find((l) => l.id === adminLoan.id).status, "approved");
checks++;
await admin(`loans/${adminLoan.id}/cancel`, "POST", {});
// PED engineering staff manage equipment and handovers, but review only their own department.
const ped = client();
await admin("users", "POST", { username: `qa.ped.${suffix}`, name: "PED Engineer", email: "", department: "PED（產品工程部）", role: "approver", password });
await ped("login", "POST", { username: `qa.ped.${suffix}`, password });
await ped("account", "PUT", { username: `qa.ped.${suffix}`, name: "PED Engineer", email: "", currentPassword: password, newPassword });
await ped("users", "POST", {}, 403);
await ped("settings", "PUT", {}, 403);
const engineerKit = { ...testEquipment, code: undefined, name: "PED engineering-managed kit" };
await ped("equipment", "POST", engineerKit);
const engineerEquipment = (await ped("state")).equipment.find(row => row.name === engineerKit.name);
assert(engineerEquipment); checks++;
await ped(`equipment/${engineerEquipment.id}`, "PUT", { ...engineerKit, condition: "maintenance" });
assert.equal((await ped("state")).equipment.find(row => row.id === engineerEquipment.id).condition, "maintenance"); checks++;
await ped(`equipment/${engineerEquipment.id}`, "PUT", { ...engineerKit, condition: "retired" });
assert.equal((await ped("state")).equipment.find(row => row.id === engineerEquipment.id).condition, "retired"); checks++;
await ped(`equipment/${engineerEquipment.id}`, "PUT", { ...engineerKit, condition: "ready" });
const crossDepartmentLoan = await admin("loans", "POST", loan);
await ped(`loans/${crossDepartmentLoan.id}/approve`, "POST", {}, 403);
await ped(`loans/${crossDepartmentLoan.id}/reject`, "POST", { note: "PED 部門名稱也不能繞過部門限制" }, 403);
await admin(`loans/${crossDepartmentLoan.id}/cancel`, "POST", {});
const pedOperator = client();
await admin("users", "POST", { username: `qa.ped.operator.${suffix}`, name: "PED operator", email: "", department: "PED（產品工程部）", role: "employee", password });
await pedOperator("login", "POST", { username: `qa.ped.operator.${suffix}`, password });
await pedOperator("account", "PUT", { username: `qa.ped.operator.${suffix}`, name: "PED operator", email: "", currentPassword: password, newPassword });
const domainLoan = await pedOperator("loans", "POST", loan);
const domainState = await ped("state");
assert(domainState.loans.some(row => row.id === domainLoan.id));
assert.equal(domainState.users.length, 0);
const originalManifest = domainState.loans.find(row => row.id === domainLoan.id).manifest;
assert.equal(originalManifest.length, 5);
assert.equal(domainState.loans.find(row => row.id === domainLoan.id).work_order, "");
assert.equal(domainState.equipment.find(row => row.id === eq.id).reserved, 1);
checks += 5;
const altered = testEquipment.components.map((part, index) => index === 0 ? { ...part, quantity: 4 } : part);
await ped(`equipment/${eq.id}`, "PUT", { ...testEquipment, components: altered }, 409);
await ped(`loans/${domainLoan.id}/approve`, "POST", { note: "PED 同部門核准" });
await ped(`loans/${domainLoan.id}/checkout`, "POST", { checklist: checklist.map((row, index) => index === 0 ? { ...row, quantity: 1 } : row) }, 400);
await ped(`loans/${domainLoan.id}/checkout`, "POST", { checklist });
const shortage = checklist.map((row, index) => index === 1 ? { ...row, quantity: 7, condition: "missing" } : row);
await ped(`loans/${domainLoan.id}/return`, "POST", { note: "" , checklist: shortage }, 400);
await ped(`loans/${domainLoan.id}/return`, "POST", { note: "DIMM 少一件，轉待補件", checklist: shortage });
const returnedState = await admin("state");
assert.equal(returnedState.equipment.find(row => row.id === eq.id).condition, "maintenance");
assert.equal(returnedState.loans.find(row => row.id === domainLoan.id).return_check[1].quantity, 7);
checks += 2;
await admin("loans", "POST", loan, 409);
await ped(`equipment/${eq.id}`, "PUT", { ...testEquipment, components: altered });
const replacementLoan = await admin("loans", "POST", loan);
const changedState = await admin("state");
assert.deepEqual(changedState.loans.find(row => row.id === domainLoan.id).manifest, originalManifest);
assert.equal(changedState.loans.find(row => row.id === replacementLoan.id).manifest[0].quantity, 4);
checks += 2;
const englishDuplicate = await admin("loans", "POST", loan, 409, base, "en");
assert.match(englishDuplicate.error, /already have a request/);
assert(!/[\u3400-\u9fff]/.test(englishDuplicate.error));
checks += 2;
await admin(`loans/${replacementLoan.id}/cancel`, "POST", {});
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
      "Setup, RBAC, operator data isolation, same-department engineer approval, cross-department approval denial, engineer equipment management and handovers, forced password change, CSRF, duplicate assets, invalid dates, overlapping reservations, self-approval prevention, checkout, return, cancellation, rejection, session revocation, disabled users, CSV source data and rate limits passed.",
  }),
);

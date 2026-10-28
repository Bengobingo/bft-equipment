import assert from "node:assert/strict";
import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";
const { outputText } = transpileModule(readFileSync(new URL("../lib/types.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.ESNext } });
const { equipmentStatus } = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
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
async function submitReturn(owner, loanId, note = "QA return requested") {
  const loan = (await owner("state")).loans.find(row => row.id === loanId);
  const selfCheck = loan.manifest.map(part => ({ id: part.id, quantity: part.quantity, condition: "ok", checked: true }));
  await owner(`loans/${loanId}/request-return`, "POST", { confirmed: true, note, self_check: selfCheck });
  const pending = (await owner("state")).loans.find(row => row.id === loanId).return_requests.find(row => row.status === "pending");
  assert(pending); checks++;
  return pending;
}
async function finishReturn(owner, reviewer, loanId, body) {
  const pending = await submitReturn(owner, loanId);
  return reviewer(`loans/${loanId}/return`, "POST", { ...body, received: true, return_request_id: pending.id });
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
  components: ["CPU", "Memory", "Cable", "Storage", "Heatsink"].map((type, index) => ({ id: `qa-part-${index}`, type, name: `${type} validation component`, specification: `Spec-${index}`, partNumber: `PN-${index}`, serial: `SN-${index}`, quantity: index === 1 ? 8 : 2 })),
};
await admin("equipment", "POST", testEquipment);
await admin("equipment", "POST", testEquipment, 409);
d = await admin("state");
const eq = d.equipment.find((e) => e.code === testEquipment.code);
assert(eq);
assert.equal(eq.components[0].specification, "Spec-0");
assert.equal(eq.components[0].serial, "SN-0");
await admin("equipment", "POST", { ...testEquipment, code: "INVALID-" + suffix, components: [{ ...testEquipment.components[0], specification: "x".repeat(101) }] }, 400);
checks += 3;
const categoryTypes = ["CPU", "Memory", "Motherboard", "Storage", "PCIe/Expansion", "Network", "Power", "Cable", "Heatsink", "Other", "DIMM", "U.2"];
const categoryEquipment = { ...testEquipment, code: "CAT-" + suffix, components: categoryTypes.map((type, index) => ({ ...testEquipment.components[0], id: `category-${index}`, type })) };
await admin("equipment", "POST", categoryEquipment);
const categorySaved = (await admin("state")).equipment.find(row => row.code === categoryEquipment.code);
assert.deepEqual(categorySaved.components.map(part => part.type), categoryTypes);
await admin(`equipment/${categorySaved.id}`, "PUT", { ...categoryEquipment, name: "Updated legacy categories" });
assert.deepEqual((await admin("state")).equipment.find(row => row.id === categorySaved.id).components.map(part => part.type), categoryTypes);
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
assert(automaticKits.every(row => /^BOX\d{3,}$/.test(row.code) && row.brand === "" && row.serial === ""));
assert.deepEqual(automaticKits.map(row => row.code).sort(), ["BOX013", "BOX014"]);
checks++;
checks += 3;
await admin(`equipment/${eq.id}`, "PUT", testEquipment);
const legacyParts = testEquipment.components.map(part => { const copy = { ...part }; delete copy.specification; return copy; });
await admin(`equipment/${eq.id}`, "PUT", { ...testEquipment, components: legacyParts });
const legacySaved = (await admin("state")).equipment.find(row => row.id === eq.id);
assert.equal(legacySaved.components[0].serial, "SN-0");
assert.equal(legacySaved.components[0].specification, undefined);
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
assert.equal(equipmentStatus(d.equipment.find(row => row.id === eq.id)), "reserved");
assert.equal(d.equipment.find(row => row.id === eq.id).awaiting_issue, 0);
checks += 2;
await employee(`loans/${l.id}/approve`, "POST", {}, 403);
await approver(`loans/${l.id}/checkout`, "POST", {}, 409);
await admin(
  "equipment/" + eq.id,
  "PUT",
  { ...testEquipment, condition: "maintenance" },
  409,
);
await approver(`loans/${l.id}/approve`, "POST", { note: "用途符合規範" });
for (const account of [employee, approver, admin]) {
  const approvedState = await account("state");
  const approvedBox = approvedState.equipment.find(row => row.id === eq.id);
  assert.equal(approvedState.loans.find(row => row.id === l.id).status, "approved");
  assert.equal(approvedBox.awaiting_issue, 1);
  assert.equal(approvedBox.busy, 0);
  assert.equal(equipmentStatus(approvedBox), "approved");
  checks += 4;
}
await approver(`loans/${l.id}/approve`, "POST", {}, 409);
await employee(`loans/${l.id}/checkout`, "POST", {}, 403);
await approver(`loans/${l.id}/checkout`, "POST", { note: "配件齊全" }, 400);
await approver(`loans/${l.id}/checkout`, "POST", { note: "配件齊全", checklist: checklist.slice(1) }, 400);
await approver(`loans/${l.id}/checkout`, "POST", { note: "配件齊全", checklist });
const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
const futureRequest = { ...loan, start: tomorrow, end: tomorrow };
const borrowerState = await employee("state");
assert.equal(borrowerState.equipment.find(row => row.id === eq.id).busy, 1);
assert.equal(borrowerState.equipment.find(row => row.id === eq.id).awaiting_issue, 0);
assert.equal(equipmentStatus(borrowerState.equipment.find(row => row.id === eq.id)), "borrowed");
checks += 2;
assert(borrowerState.loans.filter(row => row.status === "borrowed").every(row => row.user_id === borrowerState.user.id));
const unavailableFuture = await admin("loans", "POST", futureRequest, 409);
assert.equal(unavailableFuture.code, "equipment_borrowed");
assert.equal(unavailableFuture.loanId, undefined);
const ownFuture = await employee("loans", "POST", futureRequest, 409);
assert.equal(ownFuture.code, "own_reservation");
assert.equal(ownFuture.loanId, l.id);
checks += 6;
await employee(`loans/${l.id}/cancel`, "POST", {}, 409);
const unrelatedOperator = client();
const unrelatedUsername = `qa.return.other.${suffix}`;
await admin("users", "POST", { username: unrelatedUsername, name: "Other operator", email: "", department: "測試部門", role: "employee", password });
await unrelatedOperator("login", "POST", { username: unrelatedUsername, password });
await unrelatedOperator("account", "PUT", { username: unrelatedUsername, name: "Other operator", email: "", currentPassword: password, newPassword });
await unrelatedOperator(`loans/${l.id}/return`, "POST", { note: "不得驗收他人的設備箱", checklist }, 403);
await employee(`loans/${l.id}/return`, "POST", { note: "使用者不得直接完成歸還", checklist }, 403);
await approver(`loans/${l.id}/return`, "POST", { note: "尚未申請", received: true, checklist }, 409);
await unrelatedOperator(`loans/${l.id}/request-return`, "POST", { confirmed: true }, 403);
await admin(`loans/${l.id}/request-return`, "POST", { confirmed: true }, 403);
await employee(`loans/${l.id}/request-return`, "POST", { confirmed: false }, 400);
// Self-check cannot be bypassed with missing, unchecked, forged or abnormal entries.
for (const selfCheck of [
  undefined, [], checklist.slice(1),
  checklist.map(row => ({ ...row, checked: false })),
  checklist.map(row => ({ ...row, id: "unknown-part" })),
  checklist.map(row => ({ ...row, condition: "damaged" })),
  checklist.map(row => ({ ...row, condition: "missing" })),
  checklist.map(row => ({ ...row, quantity: row.quantity - 1, condition: "missing" })),
  checklist.map(row => ({ ...row, quantity: row.quantity + 1 })),
  checklist.map(row => ({ ...row, quantity: 0.5 })),
  checklist.map(() => checklist[0]),
]) await employee(`loans/${l.id}/request-return`, "POST", { confirmed: true, self_check: selfCheck }, 400);
const beforeSelfCheck = (await employee("state")).loans.find(row => row.id === l.id);
assert.equal(beforeSelfCheck.status, "borrowed");
assert.equal(beforeSelfCheck.return_requests.length, 0); checks += 2;
const firstReturn = await submitReturn(employee, l.id, "準備歸還，等待工程驗收");
assert.deepEqual(firstReturn.self_check, checklist); checks++;
const inspectorSelfCheck = (await approver("state")).loans.find(row => row.id === l.id).return_requests[0].self_check;
assert.deepEqual(inspectorSelfCheck, checklist); checks++;
assert(!(await unrelatedOperator("state")).loans.some(row => row.id === l.id)); checks++;
await employee(`loans/${l.id}/request-return`, "POST", { confirmed: true }, 409);
const pendingReturnState = await employee("state");
const pendingReturnLoan = pendingReturnState.loans.find(row => row.id === l.id);
assert.equal(pendingReturnLoan.status, "return_pending");
assert.equal(pendingReturnLoan.returned, null);
assert.equal(pendingReturnLoan.return_requests.length, 1);
assert.equal(pendingReturnState.equipment.find(row => row.id === eq.id).busy, 1);
assert.equal(pendingReturnState.equipment.find(row => row.id === eq.id).awaiting_return, 1);
assert.equal(equipmentStatus(pendingReturnState.equipment.find(row => row.id === eq.id)), "return_pending");
checks += 6;
await unrelatedOperator("loans", "POST", futureRequest, 409);
await admin(`equipment/${eq.id}`, "PUT", { ...testEquipment, condition: "maintenance" }, 409);
await admin(`equipment/${eq.id}`, "PUT", { ...testEquipment, components: testEquipment.components.map(row => ({ ...row, quantity: row.quantity + 1 })) }, 409);
await employee(`loans/${l.id}/cancel`, "POST", {}, 409);
await employee(`loans/${l.id}/return`, "POST", { return_request_id: firstReturn.id, received: true, note: "不得自行驗收", checklist }, 403);
await employee(`loans/${l.id}/reject-return`, "POST", { return_request_id: firstReturn.id, note: "不得自行處理" }, 403);
await admin(`loans/${l.id}/return`, "POST", { return_request_id: "stale", received: true, note: "過期申請", checklist }, 409);
await admin(`loans/${l.id}/return`, "POST", { return_request_id: firstReturn.id, received: true, note: "", checklist }, 400);
await admin(`loans/${l.id}/return`, "POST", { return_request_id: firstReturn.id, received: false, note: "未收到", checklist }, 400);
await admin(`loans/${l.id}/return`, "POST", { return_request_id: firstReturn.id, received: true, note: "尚未完整清點", checklist: checklist.slice(1) }, 400);
await admin(`loans/${l.id}/return`, "POST", { return_request_id: firstReturn.id, received: true, note: "尚未勾選確認", checklist: checklist.map(row => ({ ...row, checked: false })) }, 400);
await admin(`loans/${l.id}/reject-return`, "POST", { return_request_id: firstReturn.id, note: "" }, 400);
await admin(`loans/${l.id}/reject-return`, "POST", { return_request_id: firstReturn.id, note: "設備箱尚未實際交回" });
const rejectedReturn = (await employee("state")).loans.find(row => row.id === l.id);
assert.equal(rejectedReturn.status, "borrowed");
assert.equal(rejectedReturn.return_requests[0].status, "rejected");
assert.equal(rejectedReturn.return_requests[0].review_note, "設備箱尚未實際交回"); checks += 3;
const secondReturn = await submitReturn(employee, l.id, "已重新送交設備箱");
assert.notEqual(firstReturn.id, secondReturn.id); checks++;
await approver(`loans/${l.id}/return`, "POST", { return_request_id: firstReturn.id, received: true, note: "過期驗收頁面", checklist }, 409);
await approver(`loans/${l.id}/return`, "POST", { return_request_id: secondReturn.id, received: true, note: "設備正常，配件完整", checklist });
await approver(`loans/${l.id}/return`, "POST", { return_request_id: secondReturn.id, received: true, note: "重複歸還", checklist }, 409);
const inspectedReturn = (await employee("state")).loans.find(row => row.id === l.id);
assert.equal(inspectedReturn.return_requests.length, 2);
assert.deepEqual(inspectedReturn.return_requests[0].self_check, checklist);
assert.deepEqual(inspectedReturn.return_requests[1].self_check, checklist); checks += 2;
assert.equal(inspectedReturn.return_requests[1].status, "accepted");
assert.notEqual(inspectedReturn.return_requests[1].requester_id, inspectedReturn.return_requests[1].reviewer_id);
assert(inspectedReturn.return_requests[1].requested && inspectedReturn.return_requests[1].reviewed);
checks += 4;

d = await employee("state");
const returned = d.loans.find((x) => x.id === l.id);
assert.equal(returned.status, "returned");
assert.equal(returned.return_note, "設備正常，配件完整");
assert(returned.checked_out && returned.returned);
assert.equal(d.equipment.find(row => row.id === eq.id).busy, 0);
assert.equal(d.equipment.find(row => row.id === eq.id).awaiting_issue, 0);
assert.equal(equipmentStatus(d.equipment.find(row => row.id === eq.id)), "ready");
checks += 2;
assert(!d.loans.some(row => row.id === l.id && row.status === "borrowed"));
const afterReturn = await admin("loans", "POST", futureRequest);
await admin(`loans/${afterReturn.id}/cancel`, "POST", {});
checks += 5;
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
await employee(`loans/${pending.id}/approve`, "POST", {}, 403);
await cross(`loans/${pending.id}/approve`, "POST", { note: "跨部門核准" });
const crossData = await cross("state");
assert.equal(crossData.loans.find(l => l.id === pending.id).status, "approved");
assert.equal(crossData.loans.find(l => l.id === pending.id).approver_id, crossData.user.id);
checks++;
await employee(`loans/${pending.id}/cancel`, "POST", {});
assert.equal(equipmentStatus((await employee("state")).equipment.find(row => row.id === eq.id)), "ready");
checks++;
const crossRejected = await employee("loans", "POST", loan);
await cross(`loans/${crossRejected.id}/reject`, "POST", { note: "跨部門駁回" });
assert.equal((await employee("state")).loans.find(row => row.id === crossRejected.id).status, "rejected");
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
await employee(`loans/${adminLoan.id}/approve`, "POST", {}, 403);
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
// PED engineering staff manage equipment and handovers and review across departments.
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
await ped(`loans/${crossDepartmentLoan.id}/approve`, "POST", { note: "PED 跨部門核准管理員申請" });
assert.equal((await admin("state")).loans.find(row => row.id === crossDepartmentLoan.id).status, "approved");
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
assert.equal(originalManifest[0].specification, "Spec-0");
await ped(`equipment/${eq.id}`, "PUT", testEquipment);
assert.equal(domainState.loans.find(row => row.id === domainLoan.id).work_order, "");
assert.equal(domainState.equipment.find(row => row.id === eq.id).reserved, 1);
checks += 5;
const altered = testEquipment.components.map((part, index) => index === 0 ? { ...part, quantity: 4 } : part);
await ped(`equipment/${eq.id}`, "PUT", { ...testEquipment, components: altered }, 409);
await ped(`loans/${domainLoan.id}/approve`, "POST", { note: "PED 同部門核准" });
await ped(`loans/${domainLoan.id}/checkout`, "POST", { checklist: checklist.map((row, index) => index === 0 ? { ...row, quantity: 1 } : row) }, 400);
await ped(`loans/${domainLoan.id}/checkout`, "POST", { checklist });
const shortage = checklist.map((row, index) => index === 1 ? { ...row, quantity: 7, condition: "missing" } : row);
const domainReturn = await submitReturn(pedOperator, domainLoan.id);
await ped(`loans/${domainLoan.id}/return`, "POST", { return_request_id: domainReturn.id, received: true, note: "" , checklist: shortage }, 400);
await ped(`loans/${domainLoan.id}/return`, "POST", { return_request_id: domainReturn.id, received: true, note: "DIMM 少一件，轉待補件", checklist: shortage });
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
assert.equal(changedState.loans.find(row => row.id === replacementLoan.id).manifest[0].specification, "Spec-0");
checks += 2;
const englishDuplicate = await admin("loans", "POST", loan, 409, base, "en");
assert.match(englishDuplicate.error, /already have a request/);
assert(!/[\u3400-\u9fff]/.test(englishDuplicate.error));
checks += 2;
await admin(`loans/${replacementLoan.id}/cancel`, "POST", {});
// Batch handover uses an immutable payload and internal UUIDs, not display request IDs.
const batchPath = "loans/batch-checkout";
let batchCounter = 0;
async function batchLoan({ owner = employee, fixture = "BATCH-FCT", date = today, approve = true } = {}) {
  const code = `BATCH-${suffix}-${++batchCounter}`;
  await admin("equipment", "POST", { ...testEquipment, code, name: code });
  const equipment = (await admin("state")).equipment.find(row => row.code === code);
  const created = await owner("loans", "POST", { ...loan, equipment_id: equipment.id, production_line: fixture, start: date, end: date });
  if (approve) await approver(`loans/${created.id}/approve`, "POST", { note: "Batch test approval" });
  return (await admin("state")).loans.find(row => row.id === created.id);
}
const batchItem = row => ({ loanId: row.id, expectedUpdated: row.updated, confirmed: true });
const batchPayload = rows => ({ batchId: crypto.randomUUID(), note: "Batch physical inspection completed", items: rows.map(batchItem) });
const ba = await batchLoan(), bb = await batchLoan();
const normalBatch = batchPayload([ba, bb]);
await anon(batchPath, "POST", normalBatch, 401);
await employee(batchPath, "POST", normalBatch, 403);
await approver(batchPath, "POST", { ...normalBatch, items: [] }, 400);
await approver(batchPath, "POST", { ...normalBatch, items: Array(51).fill(batchItem(ba)) }, 400);
await approver(batchPath, "POST", { ...normalBatch, items: [batchItem(ba), batchItem(ba)] }, 400);
const noConfirmation = await approver(batchPath, "POST", { ...batchPayload([ba]), items: [{ ...batchItem(ba), confirmed: false }] }, 200, base, "en");
assert.equal(noConfirmation.failed, 1);
assert.match(noConfirmation.results[0].error, /Confirm/);
assert.equal((await admin("state")).loans.find(row => row.id === ba.id).status, "approved"); checks += 3;
const normalResult = await approver(batchPath, "POST", normalBatch);
assert.equal(normalResult.succeeded, 2); assert.equal(normalResult.failed, 0);
const afterBatch = await admin("state");
for (const original of [ba, bb]) {
  const issued = afterBatch.loans.find(row => row.id === original.id);
  assert.equal(issued.status, "borrowed");
  assert.equal(issued.checkout_batch_id, normalBatch.batchId);
  assert.deepEqual(issued.checkout_check, checklist);
  assert.deepEqual(issued.manifest, original.manifest);
  assert.equal(afterBatch.events.filter(event => event.target === original.id && event.action === "辦理設備領用").length, 1);
  checks += 5;
}
checks += 2;
const normalRetry = await approver(batchPath, "POST", normalBatch);
assert.equal(normalRetry.succeeded, 2); checks++;
await admin(batchPath, "POST", normalBatch, 409); // Another actor cannot replay the batch ID.
await approver(batchPath, "POST", { ...normalBatch, note: "different payload" }, 409);
await employee(`checkout-batches/${normalBatch.batchId}`, "GET", undefined, 403);
const batchRecord = await admin(`checkout-batches/${normalBatch.batchId}`);
assert.equal(batchRecord.items.length, 2);
assert.equal(batchRecord.actor_id, afterBatch.users.find(row => row.username === users.approver.username).id);
assert(batchRecord.items.every(item => item.status === "success")); checks += 3;
// Each batch-issued box can be returned independently by its borrower.
await finishReturn(employee, admin, ba.id, { note: "Batch box returned independently", checklist });
await approver(batchPath, "POST", normalBatch);
const afterIndependentReturn = await admin("state");
assert.equal(afterIndependentReturn.loans.find(row => row.id === ba.id).status, "returned");
assert.equal(afterIndependentReturn.loans.find(row => row.id === bb.id).status, "borrowed");
assert.equal(afterIndependentReturn.events.filter(event => event.target === ba.id && event.action === "辦理設備領用").length, 1);
checks += 3;
await finishReturn(employee, admin, bb.id, { note: "Second batch box returned", checklist });
const bc = await batchLoan(), bd = await batchLoan();
const partialPayload = batchPayload([bc, bd]);
await employee(`loans/${bd.id}/cancel`, "POST", {});
const partial = await admin(batchPath, "POST", partialPayload, 200, base, "en");
assert.equal(partial.succeeded, 1); assert.equal(partial.failed, 1);
assert(partial.results.find(row => row.loanId === bd.id).error);
assert(!/[\u3400-\u9fff]/.test(partial.results.find(row => row.loanId === bd.id).error));
const partialRetry = await admin(batchPath, "POST", partialPayload);
assert.equal(partialRetry.succeeded, 1); assert.equal(partialRetry.failed, 1);
const partialState = await admin("state");
assert.equal(partialState.loans.find(row => row.id === bc.id).status, "borrowed");
assert.equal(partialState.loans.find(row => row.id === bd.id).status, "cancelled");
assert.equal(partialState.events.filter(event => event.target === bc.id && event.action === "辦理設備領用").length, 1);
checks += 9;
await finishReturn(employee, admin, bc.id, { note: "Partial batch success returned", checklist });
const batchTomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
const bf = await batchLoan({ date: batchTomorrow });
const futureResult = await admin(batchPath, "POST", batchPayload([bf]), 200, base, "en");
assert.equal(futureResult.failed, 1); assert.match(futureResult.results[0].error, /borrowing period/); checks += 2;
const bp = await batchLoan({ approve: false });
assert.equal((await admin(batchPath, "POST", batchPayload([bp]))).failed, 1); checks++;
const be = await batchLoan();
const staleBatch = batchPayload([be]); staleBatch.items[0].expectedUpdated = "2000-01-01T00:00:00.000Z";
const staleResult = await admin(batchPath, "POST", staleBatch, 200, base, "en");
assert.equal(staleResult.failed, 1); assert.match(staleResult.results[0].error, /changed/); checks += 2;
const otherFixture = await batchLoan({ fixture: "OTHER-FCT" });
const mixedFixture = await batchLoan({ fixture: "MIXED-FCT" });
const mixedPayload = batchPayload([otherFixture, mixedFixture]);
const mixedResult = await admin(batchPath, "POST", mixedPayload);
assert.equal(mixedResult.succeeded, 2); assert.equal(mixedResult.failed, 0);
const mixedRecord = await admin(`checkout-batches/${mixedPayload.batchId}`);
assert.equal(mixedRecord.production_line, "");
assert.deepEqual(mixedRecord.items.map(row => row.production_line).sort(), ["MIXED-FCT", "OTHER-FCT"]);
const mixedState = await admin("state");
assert.equal(mixedState.loans.find(row => row.id === otherFixture.id).production_line, "OTHER-FCT");
assert.equal(mixedState.loans.find(row => row.id === mixedFixture.id).production_line, "MIXED-FCT");
assert.equal((await admin(batchPath, "POST", mixedPayload)).succeeded, 2);
await finishReturn(employee, admin, otherFixture.id, { note: "Independent mixed-fixture return", checklist });
const mixedReturnState = await admin("state");
assert.equal(mixedReturnState.loans.find(row => row.id === mixedFixture.id).status, "borrowed");
await finishReturn(employee, admin, mixedFixture.id, { note: "Second fixture returned", checklist });
checks += 8;
const otherOwner = await batchLoan({ owner: admin });
await admin(batchPath, "POST", batchPayload([be, otherOwner]), 400);
const nextLoan = await employee("loans", "POST", { ...loan, equipment_id: be.equipment_id, production_line: be.production_line, start: batchTomorrow, end: batchTomorrow });
await approver(`loans/${nextLoan.id}/approve`, "POST", {});
const nextSaved = (await admin("state")).loans.find(row => row.id === nextLoan.id);
await admin(batchPath, "POST", batchPayload([be, nextSaved]), 400);
const missingIdPayload = batchPayload([be]);
missingIdPayload.items.push({ ...batchItem(be), loanId: crypto.randomUUID() });
const missingIdResult = await admin(batchPath, "POST", missingIdPayload);
assert.equal(missingIdResult.succeeded, 1); assert.equal(missingIdResult.failed, 1); checks += 2;
await finishReturn(employee, admin, be.id, { note: "Returned after missing-item batch", checklist });
const br = await batchLoan();
const sameBatch = batchPayload([br]);
const simultaneous = await Promise.all([approver(batchPath, "POST", sameBatch), approver(batchPath, "POST", sameBatch)]);
assert(simultaneous.every(row => row.succeeded === 1));
const simultaneousState = await admin("state");
assert.equal(simultaneousState.events.filter(event => event.target === br.id && event.action === "辦理設備領用").length, 1); checks += 2;
await finishReturn(employee, admin, br.id, { note: "Returned after duplicate submission", checklist });
const bs = await batchLoan();
const competing = await Promise.all([admin(batchPath, "POST", batchPayload([bs])), approver(batchPath, "POST", batchPayload([bs]))]);
assert.equal(competing.reduce((sum, row) => sum + row.succeeded, 0), 1);
assert.equal(competing.reduce((sum, row) => sum + row.failed, 0), 1);
assert.equal((await admin("state")).events.filter(event => event.target === bs.id && event.action === "辦理設備領用").length, 1); checks += 3;
await finishReturn(employee, admin, bs.id, { note: "Returned after competing batches", checklist });

// Boundary: 50 different boxes are accepted even when all BR display numbers coincide.
const maximumLoans = [];
for (let index = 0; index < 50; index++) maximumLoans.push(await batchLoan({ fixture: `MAX-${index + 1}` }));
const maximumPayload = batchPayload(maximumLoans);
const maximumResult = await approver(batchPath, "POST", maximumPayload);
assert.equal(maximumResult.succeeded, 50); assert.equal(maximumResult.failed, 0);
assert.equal(new Set(maximumResult.results.map(row => row.loanId)).size, 50);
const maximumRecord = await admin(`checkout-batches/${maximumPayload.batchId}`);
assert.equal(maximumRecord.items.length, 50);
assert.equal(new Set(maximumRecord.items.map(row => row.production_line)).size, 50);
checks++;
checks += 4;
await finishReturn(employee, admin, maximumLoans[0].id, { note: "Independent return from 50-box batch", checklist });
const maximumState = await admin("state");
assert.equal(maximumState.loans.find(row => row.id === maximumLoans[0].id).status, "returned");
assert(maximumLoans.slice(1).every(original => maximumState.loans.find(row => row.id === original.id).status === "borrowed"));
checks += 2;
// Leave two approved requests for manual UI verification on this disposable database.
await batchLoan({ owner: admin, fixture: "UI-BATCH-A" });
await batchLoan({ owner: admin, fixture: "UI-BATCH-B" });

// Return inspection must be independent even when the borrower is a manager.
let inspectionCounter = 0;
async function inspectionLoan(owner, reviewer) {
  const code = `INSPECT-${suffix}-${++inspectionCounter}`;
  await admin("equipment", "POST", { ...testEquipment, code, name: code });
  const box = (await admin("state")).equipment.find(row => row.code === code);
  const created = await owner("loans", "POST", { ...loan, equipment_id: box.id });
  await reviewer(`loans/${created.id}/approve`, "POST", {});
  await reviewer(`loans/${created.id}/checkout`, "POST", { checklist });
  return (await owner("state")).loans.find(row => row.id === created.id);
}
for (const [owner, reviewer] of [[admin, approver], [approver, admin]]) {
  const borrowed = await inspectionLoan(owner, reviewer);
  const request = await submitReturn(owner, borrowed.id);
  const body = { return_request_id: request.id, received: true, note: "Independent physical inspection", checklist };
  await owner(`loans/${borrowed.id}/return`, "POST", body, 403);
  await owner(`loans/${borrowed.id}/reject-return`, "POST", { return_request_id: request.id, note: "Self-inspection forbidden" }, 403);
  await reviewer(`loans/${borrowed.id}/return`, "POST", body);
  const saved = (await owner("state")).loans.find(row => row.id === borrowed.id);
  assert.equal(saved.status, "returned");
  assert.notEqual(saved.return_requests[0].requester_id, saved.return_requests[0].reviewer_id); checks += 2;
}
const returnRaceLoan = await inspectionLoan(employee, admin);
const duplicateReturns = await Promise.all([
  employee(`loans/${returnRaceLoan.id}/request-return`, "POST", { confirmed: true, self_check: checklist }, [200, 409]),
  employee(`loans/${returnRaceLoan.id}/request-return`, "POST", { confirmed: true, self_check: checklist }, [200, 409]),
]);
assert.equal(duplicateReturns.filter(row => row.ok).length, 1); checks++;
const returnRaceState = await admin("state");
const raceReturn = returnRaceState.loans.find(row => row.id === returnRaceLoan.id).return_requests;
assert.equal(raceReturn.length, 1); checks++;
const raceBody = { return_request_id: raceReturn[0].id, received: true, note: "Concurrent inspection", checklist };
const doubleInspections = await Promise.all([
  admin(`loans/${returnRaceLoan.id}/return`, "POST", raceBody, [200, 409]),
  approver(`loans/${returnRaceLoan.id}/return`, "POST", raceBody, [200, 409]),
]);
assert.equal(doubleInspections.filter(row => row.ok).length, 1);
const afterRace = await admin("state");
assert.equal(afterRace.loans.find(row => row.id === returnRaceLoan.id).status, "returned");
assert.equal(afterRace.events.filter(row => row.target === returnRaceLoan.id && row.action === "完成設備歸還").length, 1);
assert.equal(afterRace.events.filter(row => row.target === returnRaceLoan.id && row.action === "提出歸還申請").length, 1); checks += 4;
const competingReturnLoan = await inspectionLoan(employee, admin);
const competingRequest = await submitReturn(employee, competingReturnLoan.id);
const blockedBatch = await admin(batchPath, "POST", batchPayload([competingReturnLoan]));
assert.equal(blockedBatch.succeeded, 0); assert.equal(blockedBatch.failed, 1); checks += 2;
const inspectionConflict = await Promise.all([
  admin(`loans/${competingReturnLoan.id}/return`, "POST", { return_request_id: competingRequest.id, received: true, note: "Received", checklist }, [200, 409]),
  approver(`loans/${competingReturnLoan.id}/reject-return`, "POST", { return_request_id: competingRequest.id, note: "Not received" }, [200, 409]),
]);
assert.equal(inspectionConflict.filter(row => row.ok).length, 1);
const conflictState = await admin("state");
const conflictSaved = conflictState.loans.find(row => row.id === competingReturnLoan.id);
assert(["returned", "borrowed"].includes(conflictSaved.status));
assert.equal(conflictSaved.return_requests[0].status, conflictSaved.status === "returned" ? "accepted" : "rejected");
assert.equal(conflictState.equipment.find(row => row.id === competingReturnLoan.equipment_id).busy, conflictSaved.status === "returned" ? 0 : 1); checks += 4;
const damagedReturnLoan = await inspectionLoan(employee, admin);
const damagedRequest = await submitReturn(employee, damagedReturnLoan.id);
await approver(`loans/${damagedReturnLoan.id}/return`, "POST", { return_request_id: damagedRequest.id, received: true, note: "CPU damaged; received and routed to maintenance", checklist: checklist.map((part, index) => index === 0 ? { ...part, condition: "damaged" } : part) });
const damagedState = await admin("state");
assert.equal(damagedState.loans.find(row => row.id === damagedReturnLoan.id).status, "returned");
assert.equal(damagedState.equipment.find(row => row.id === damagedReturnLoan.equipment_id).condition, "maintenance");
assert.equal(damagedState.loans.find(row => row.id === damagedReturnLoan.id).return_requests[0].status, "accepted"); checks += 3;

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
      "Setup, RBAC, operator data isolation, same-department and cross-department engineer approval and rejection, engineer equipment management and handovers, forced password change, CSRF, duplicate assets, invalid dates, overlapping reservations, self-approval prevention, checkout, return, cancellation, rejection, session revocation, disabled users, CSV source data and rate limits passed.",
  }),
);

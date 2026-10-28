import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";
const { outputText } = transpileModule(readFileSync(new URL("../lib/types.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.ESNext } });
const { notificationLoans, overdue, taipeiDate, canRequestReturn, canReturnLoan, equipmentStatus } = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
const requests = [
  { id: "pending-operator", user_id: "operator", status: "pending" },
  { id: "pending-admin", user_id: "admin", status: "pending" },
  { id: "pending-engineer", user_id: "engineer", status: "pending" },
  { id: "approved-operator", user_id: "operator", status: "approved" },
  { id: "approved-admin", user_id: "admin", status: "approved" },
  { id: "borrowed-operator", user_id: "operator", status: "borrowed", end: "2000-01-01" },
  { id: "borrowed-other", user_id: "other", status: "borrowed", end: "2099-01-01" },
  { id: "borrowed-admin", user_id: "admin", status: "borrowed", end: "2099-01-01" },
  ...["returned", "rejected", "cancelled"].map(status => ({ id: status, user_id: "operator", status })),
];
const original = JSON.stringify(requests);
const ids = user => notificationLoans(user, requests).map(row => row.id);
assert.deepEqual(ids({ id: "admin", role: "admin" }), ["pending-operator", "pending-engineer", "approved-operator", "approved-admin"]);
assert.deepEqual(ids({ id: "engineer", role: "approver" }), ["pending-operator", "pending-admin", "approved-operator", "approved-admin"]);
assert.deepEqual(ids({ id: "operator", role: "employee" }), ["borrowed-operator"]);
assert.deepEqual(ids({ id: "other", role: "employee" }), ["borrowed-other"]);
assert.deepEqual(ids({ id: "none", role: "employee" }), []);
assert.deepEqual(notificationLoans({ id: "operator", role: "employee" }, requests.map(row => row.status === "borrowed" ? { ...row, status: "returned" } : row)), []);
assert.deepEqual(notificationLoans({ id: "admin", role: "admin" }, requests.filter(row => ["borrowed", "returned", "rejected", "cancelled"].includes(row.status))), []);
assert.deepEqual(notificationLoans({ id: "admin", role: "admin" }, []), []);
assert.equal(JSON.stringify(requests), original);
assert.equal(overdue({ status: "borrowed", end: "2000-01-01" }), true);
assert.equal(overdue({ status: "borrowed", end: taipeiDate() }), false);
assert.equal(overdue({ status: "borrowed", end: "2099-01-01" }), false);
assert.equal(overdue({ status: "returned", end: "2000-01-01" }), false);
console.log("Notification rules passed: 13 checks across roles, ownership, overdue boundaries, completion and empty queues.");

const owner = { id: "operator", role: "employee" }, inspector = { id: "engineer", role: "approver" };
const pendingReturn = { id: "return-queue", user_id: "operator", status: "return_pending", end: "2000-01-01" };
assert.equal(canRequestReturn(owner, { user_id: "operator", status: "borrowed" }), true);
assert.equal(canRequestReturn(inspector, { user_id: "operator", status: "borrowed" }), false);
assert.equal(canReturnLoan(owner, pendingReturn), false);
assert.equal(canReturnLoan(inspector, pendingReturn), true);
assert.equal(canReturnLoan({ id: "operator", role: "admin" }, pendingReturn), false);
assert.equal(canReturnLoan(inspector, { ...pendingReturn, status: "borrowed" }), false);
assert.deepEqual(notificationLoans(inspector, [pendingReturn]), [pendingReturn]);
assert.deepEqual(notificationLoans(owner, [pendingReturn]), [pendingReturn]);
assert.equal(overdue(pendingReturn), true);
assert.equal(equipmentStatus({ condition: "ready", components: [{}], busy: 1, awaiting_return: 1 }), "return_pending");
console.log("Return permission and occupancy rules passed: 10 checks.");

// Isolated local browser QA. Never point this harness at the working database.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const base = process.env.BFT_QA_URL;
assert(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname) && new URL(base).port !== "3000", "Set an explicit isolated QA URL; production port 3000 is forbidden.");
const skill = process.env.BFT_TASTE_ROOT;
assert(skill, "Set BFT_TASTE_ROOT.");
const { Browser } = await import(pathToFileURL(skill + "/scripts/lib/cdp.mjs").href);
const { probe, layout, app } = await import(pathToFileURL(skill + "/scripts/lib/probe.mjs").href);
const { judge, judgeLayout, judgeApp, APP_SKIP } = await import(pathToFileURL(skill + "/scripts/lib/rules.mjs").href);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume(); console.log("Ready for isolated PED QA credentials (hidden).");
const auth = JSON.parse(await new Promise(resolve => { let value = ""; const read = chunk => { value += chunk.toString(); if (/[\r\n]/.test(value)) { process.stdin.off("data", read); process.stdin.pause(); resolve(value.trim()); } }; process.stdin.on("data", read); }));
assert.equal(auth.username, "qa.admin", "Use the integration test account only.");
const out = ".taste-skill/qa/ped"; mkdirSync(out, { recursive: true });
const browser = await Browser.launch(); const page = await browser.newPage({ width: 1440, height: 1000 });
await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
const external = new Set(); await page.send("Network.enable");
browser.on(page.sessionId, "Network.requestWillBeSent", ({ request }) => { if (/^https?:/.test(request.url) && new URL(request.url).origin !== new URL(base).origin) external.add(request.url); });
let checks = 0; let stage = "login"; const findings = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) { for (let i = 0; i < 100; i++) { if (await page.eval(fn)) { checks++; return; } await pause(100); } throw new Error("Timeout: " + label); }
async function click(text, selector = "button") { assert(await page.eval(({ text, selector }) => { const button = [...document.querySelectorAll(selector)].find(element => element.textContent.trim() === text); if (!button) return false; button.click(); return true; }, { text, selector }), "Missing control: " + text); checks++; await pause(100); }
async function fill(selector, value, index = 0) { await page.eval(({ selector, value, index }) => { const element = document.querySelectorAll(selector)[index]; if (!element) throw new Error("Missing field: " + selector); const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); }, { selector, value, index }); }
const field = (name, value) => fill(`[name="${name}"]`, value);
async function go(route, title) { await page.eval(route => location.hash = route, route); await until(() => !!document.querySelector(".sheet h1"), "workspace"); await pause(100); if (title) assert.equal(await page.eval(() => document.querySelector(".sheet h1").textContent), title); }
const state = () => page.eval(async () => (await fetch("/api/state")).json());
async function shot(name, width = 1440, height = 1000) { await page.setViewport({ width, height, mobile: width < 600 }); await pause(100); assert(await page.eval(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal page overflow: " + name); checks++; await page.screenshot({ path: `${out}/${name}.png`, format: "png" }); }
function client() { let cookie = ""; return async (path, body, method = "POST") => { const r = await fetch(base + "/api/" + path, { method, headers: { Origin: base, "Content-Type": "application/json", Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const data = await r.json(); assert.equal(r.status, 200, `${method} ${path}: ${data.error || "failed"}`); if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0]; return data; }; }
async function newBorrow(equipmentId, purpose) { await go("dashboard"); await click("Request a box"); await until(() => !!document.querySelector("dialog[open]"), "borrow dialog"); assert.equal(await page.eval(() => document.querySelector('[name="production_line"]').closest("label").querySelector("span").textContent), "Fixture"); assert.equal(await page.eval(() => document.querySelectorAll('dialog [name="work_order"]').length), 0); checks += 2; await field("equipment_id", equipmentId); await field("production_line", "FCT-02"); await field("product_model", "Server Platform QA"); await field("purpose", purpose); }
async function rowAction(name, action) { assert(await page.eval(({ name, action }) => { const row = [...document.querySelectorAll(".loan-table tbody tr")].find(row => row.textContent.includes(name)); const control = row && [...row.querySelectorAll("button")].find(button => button.textContent.trim() === action); if (!control) return false; control.click(); return true; }, { name, action })); checks++; await pause(100); }
try {
  await page.goto(base, { settleMs: 500 }); await until(() => !!document.querySelector('[name="username"]'), "sign-in");
  await shot("login-zh-light"); await field("username", auth.username); await field("password", auth.password); await click("登入工作空間");
  await until(() => document.querySelector(".sheet h1")?.textContent === "總覽", "production dashboard");
  assert.equal((await state()).user.username, "qa.admin"); checks++;
  for (const width of [1440, 768, 390, 375]) {
    await shot(`dashboard-zh-light-${width}`, width, width > 600 ? 1000 : 844);
    const m = await page.eval(probe), l = await page.eval(layout), a = await page.eval(app);
    findings.push({ width, findings: [...judge(m, { appMode: true }), ...judgeLayout(l), ...judgeApp(a, m)].filter(item => !APP_SKIP.has(item.id)) });
  }
  console.log("Dashboard and responsive shell passed."); stage = "theme and language";
  await page.eval(() => document.querySelector(".theme-toggle").click()); await until(() => document.documentElement.dataset.theme === "dark", "dark mode");
  await page.eval(() => document.querySelector(".language-toggle").click()); await until(() => document.documentElement.lang === "en" && document.querySelector(".sheet h1").textContent === "dashboard", "English UI");
  await shot("dashboard-en-dark-1440");
  if (process.env.BFT_QA_VISUAL_ONLY === "1") {
    const geometry = await page.eval(() => Object.fromEntries([".topbar", ".workspace-search", ".top-actions", ".appearance-controls", ".top-avatar"].map(selector => { const element = document.querySelector(selector), rect = element.getBoundingClientRect(); return [selector, { left: rect.left, right: rect.right, width: rect.width, scroll: element.scrollWidth, client: element.clientWidth }]; })));
    assert(geometry[".top-avatar"].right <= 1440, "Topbar account control must stay in the viewport");
    console.log(JSON.stringify({ ok: true, checks, geometry, findings }));
    await browser.close(); process.exit(0);
  }
  for (const [route, title] of [["equipment", "Equipment box list"], ["loans", "Production loans"], ["approvals", "PED approval center"], ["reports", "Box utilization reports"], ["users", "Members & permissions"], ["audit", "Activity & handovers"], ["settings", "Account & preferences"]]) { await go(route, title); checks++; }
  stage = "three member roles"; await go("users"); await click("Add member"); await until(() => !!document.querySelector("dialog[open]"), "member editor");
  assert.deepEqual(await page.eval(() => [...document.querySelectorAll("dialog select option")].map(option => [option.value, option.textContent])), [["employee", "Production operator"], ["approver", "PED engineer"], ["admin", "Administrator"]]); checks++;
  await page.eval(() => document.querySelector("dialog .language-toggle").click()); await until(() => document.documentElement.lang === "zh-Hant", "Chinese roles");
  assert.deepEqual(await page.eval(() => [...document.querySelectorAll("dialog select option")].map(option => option.textContent)), ["產線操作人員", "PED 工程人員", "系統管理員"]); checks++;
  assert(!(await page.eval(() => document.querySelector(".sheet").textContent.includes("設備箱管理員")))); checks++;
  await page.eval(() => document.querySelector("dialog .language-toggle").click()); await until(() => document.documentElement.lang === "en", "English roles restored"); await click("Cancel", ".dialog-footer button");
  assert(!(await state()).users.some(row => row.role === "custodian")); checks++;
  await go("settings"); await click("Appearance & language"); assert.equal(await page.eval(() => document.querySelector('[aria-label="Interface language"]').value), "en"); checks++;
  await shot("preferences-en-dark");
  stage = "register kit"; await go("equipment"); await click("Register box"); await until(() => !!document.querySelector("dialog[open]"), "register kit dialog");
  const name = "Server Production Kit / UI " + Date.now();
  assert.equal(await page.eval(() => document.querySelectorAll('dialog [name="code"], dialog [name="serial"], dialog [name="brand"]').length), 0); checks++;
  await field("name", name); await field("model", "Dual Socket Server"); await field("location", "PED / Rack QA-01");
  for (let i = 0; i < 5; i++) { await click("Add component"); await fill('[aria-label="Component type"]', ["CPU", "Memory", "Cable", "Storage", "Heatsink"][i], i); await fill('[aria-label="Component name"]', ["Validation CPU", "DDR5 RDIMM", "Signal Cable", "U.2 NVMe", "CPU Heatsink"][i], i); await fill(`.component-row:nth-of-type(${i + 1}) .field:nth-of-type(3) input`, "QA-SPEC-" + i); await fill(`.component-row:nth-of-type(${i + 1}) .field:nth-of-type(4) input`, "QA-PN-" + i); await fill(`.component-row:nth-of-type(${i + 1}) input[type=number]`, i === 1 ? 8 : 2); }
  await page.eval(() => document.querySelector(".language-toggle").click()); await until(() => document.documentElement.lang === "zh-Hant", "switch form to Chinese"); assert.equal(await page.eval(() => document.querySelector('[name="name"]').value), name); checks++;
  await page.eval(() => document.querySelector(".language-toggle").click()); await until(() => document.documentElement.lang === "en", "restore English"); await shot("component-editor-en-dark"); await click("Save box"); await until(() => !document.querySelector("dialog[open]"), "kit saved");
  const kit = (await state()).equipment.find(kit => kit.name === name); assert.equal(kit.components.length, 5); assert.match(kit.code, /^BOX\d{3,}$/); checks += 2;
  await go("equipment");
  await page.eval(async id => { const input = document.querySelector("#workspace-search"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, id); input.dispatchEvent(new Event("input", { bubbles: true })); }, kit.code);
  await click("Edit"); await until(() => !!document.querySelector("dialog[open]"), "simplified edit form");
  assert.equal(await page.eval(() => document.querySelectorAll('dialog [name="code"], dialog [name="serial"], dialog [name="brand"]').length), 0); checks++;
  await shot("simplified-edit-en-dark"); await click("Save box"); await until(() => !document.querySelector("dialog[open]"), "simplified edit saved");
  assert.equal((await state()).equipment.find(row => row.id === kit.id).code, kit.code); checks++;
  stage = "admin production request"; await newBorrow(kit.id, "Server production validation");
  await shot("fixture-request-en-dark");
  await page.eval(() => document.querySelector(".language-toggle").click()); await until(() => document.documentElement.lang === "zh-Hant", "Chinese fixture form");
  assert.equal(await page.eval(() => document.querySelector('[name="production_line"]').closest("label").querySelector("span").textContent), "站別");
  assert(!(await page.eval(() => document.querySelector("dialog[open]").textContent.includes("生產工單")))); checks += 2;
  await shot("fixture-request-zh-dark-390", 390, 844);
  await page.eval(() => document.querySelector(".language-toggle").click()); await until(() => document.documentElement.lang === "en", "English fixture form");
  assert.equal(await page.eval(() => document.querySelector('[name="production_line"]').value), "FCT-02"); checks++;
  await page.eval(() => { const form = document.querySelector("dialog[open] form"); form.requestSubmit(); form.requestSubmit(); });
  await until(() => location.hash === "#approvals/submitted" && !document.querySelector("dialog[open]"), "own request routed to submitted queue");
  let current = await state(); const own = current.loans.filter(loan => loan.equipment_id === kit.id); assert.equal(own.length, 1); assert.equal(own[0].status, "pending"); assert.equal(own[0].manifest.length, 5); checks += 3;
  assert.equal(own[0].production_line, "FCT-02"); assert.equal(own[0].work_order, ""); checks += 2;
  assert(!(await page.eval(() => [...document.querySelectorAll(".loan-table button")].some(button => button.textContent.trim() === "Review")))); checks++;
  await page.goto(base + "/?qa=" + Date.now() + "#approvals/submitted", { settleMs: 500 }); await until(() => !!document.querySelector(".loan-table"), "saved request after reload"); assert.equal(await page.eval(() => document.documentElement.dataset.theme), "dark"); assert.equal(await page.eval(() => document.documentElement.lang), "en"); checks += 2;
  await newBorrow(kit.id, "Duplicate form data must be retained"); await click("Submit production request"); await until(() => document.querySelector("dialog[open] [role=alert]")?.textContent.includes("already have a request"), "English duplicate error");
  assert.equal(await page.eval(() => document.querySelector('[name="purpose"]').value), "Duplicate form data must be retained"); checks++; await shot("duplicate-en-dark-390", 390, 844); await click("Open existing request"); await until(() => document.querySelector("dialog[open] h2")?.textContent === "Box loan details", "original request link"); assert(!(await page.eval(() => [...document.querySelectorAll("dialog[open] button")].some(button => button.textContent.trim() === "Approve")))); checks++; await click("Close");
  console.log("Bilingual kit registration, manifests, duplicate prevention and own queue passed.");
  stage = "PED approval and handover";
  const adminApi = client(); await adminApi("login", auth);
  const password = randomBytes(3).toString("hex"), newPassword = randomBytes(3).toString("hex");
  const reviewer = "qa.ui.ped." + Date.now(); const engineerDepartment = (await state()).user.department;
  await adminApi("users", { username: reviewer, name: "PED UI Engineer", email: "", department: engineerDepartment, role: "approver", password });
  const ped = client(); await ped("login", { username: reviewer, password }); await ped("account", { username: reviewer, name: "PED UI Engineer", email: "", currentPassword: password, newPassword }, "PUT"); await ped(`loans/${own[0].id}/approve`, { note: "Same-department production validation approved by PED" });
  await page.eval(() => document.querySelector('[aria-label="Refresh data"]').click()); await until(() => !!document.querySelector(".sheet h1"), "refresh approved loan"); await pause(200); await go("loans/approved"); await rowAction(name, "Issue"); await until(() => !!document.querySelector(".checklist"), "issue checklist");
  assert(await page.eval(() => document.querySelector('dialog button[type="submit"]').disabled)); checks++;
  await page.eval(() => document.querySelectorAll(".check-identity input").forEach(input => input.click())); await field("note", "All P/N and serials verified"); await shot("issue-checklist-en-dark"); await click("Confirm box issue"); await until(() => !document.querySelector("dialog[open]"), "issued"); current = await state(); assert.equal(current.loans.find(loan => loan.id === own[0].id).checkout_check.length, 5); checks++;
  await go("loans/borrowed"); await rowAction(name, "Return"); await until(() => !!document.querySelector(".checklist"), "return checklist"); await page.eval(() => document.querySelectorAll(".check-identity input").forEach(input => input.click())); await fill(".check-controls input", 7, 1); await field("note", "One DIMM missing; PED replenishment required"); await shot("return-checklist-en-dark-390", 390, 844); await click("Confirm return"); await until(() => !document.querySelector("dialog[open]"), "return saved"); current = await state(); assert.equal(current.equipment.find(row => row.id === kit.id).condition, "maintenance"); assert.equal(current.loans.find(row => row.id === own[0].id).return_check[1].quantity, 7); checks += 2;
  console.log("PED approval, per-part handover and shortage maintenance passed.");
  stage = "PED engineer permissions";
  const engineerKitName = "PED Engineer Handover Kit " + Date.now();
  await adminApi("equipment", { ...kit, code: undefined, name: engineerKitName, condition: "ready" });
  const engineerKit = (await adminApi("state", undefined, "GET")).equipment.find(row => row.name === engineerKitName);
  const engineerToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await adminApi("loans", { equipment_id: engineerKit.id, start: engineerToday, end: engineerToday, production_line: "FCT-01", product_model: "Server QA", purpose: "Engineer review and handover validation" });
  await go("settings"); await click("Sign out"); await until(() => !!document.querySelector('[name="username"]'), "engineer sign-in screen");
  await field("username", reviewer); await field("password", newPassword); await click("Sign in"); await until(() => document.querySelector(".sheet h1")?.textContent === "dashboard", "engineer dashboard");
  assert(await page.eval(() => document.querySelector(".sidebar-account").textContent.includes("PED engineer")));
  assert(!(await page.eval(() => document.querySelector(".sidebar nav").textContent.includes("Members & permissions")))); checks += 2;
  await go("equipment"); await click("Register box"); await until(() => !!document.querySelector("dialog[open]"), "engineer can register kit"); await click("Cancel", ".dialog-footer button");
  await fill("#workspace-search", engineerKit.code); await click("Edit"); await until(() => !!document.querySelector("dialog[open]"), "engineer can edit kit"); await click("Save box"); await until(() => !document.querySelector("dialog[open]"), "engineer edit saved");
  await go("approvals");
  assert(await page.eval(name => [...document.querySelectorAll(".loan-table tbody tr")].every(row => row.textContent.includes(name)), engineerKitName)); checks++;
  await rowAction(engineerKitName, "Review"); await field("note", "Reviewed by same-department engineering staff"); await click("Approve request"); await until(() => !document.querySelector("dialog[open]"), "engineer approval saved");
  await go("loans/approved"); await rowAction(engineerKitName, "Issue"); await until(() => !!document.querySelector(".checklist"), "engineer issue checklist");
  await page.eval(() => document.querySelectorAll(".check-identity input").forEach(input => input.click())); await field("note", "Engineer checked all parts"); await click("Confirm box issue"); await until(() => !document.querySelector("dialog[open]"), "engineer issued kit");
  await go("loans/borrowed"); await rowAction(engineerKitName, "Return"); await until(() => !!document.querySelector(".checklist"), "engineer return checklist");
  await page.eval(() => document.querySelectorAll(".check-identity input").forEach(input => input.click())); await field("note", "Engineer return inspection complete"); await click("Confirm return"); await until(() => !document.querySelector("dialog[open]"), "engineer return saved");
  assert.equal((await state()).loans.find(row => row.equipment_id === engineerKit.id).return_note, "Engineer return inspection complete"); checks++;
  await go("equipment"); await fill("#workspace-search", engineerKit.code); await click("Edit"); await field("condition", "retired"); await click("Save box"); await until(() => !document.querySelector("dialog[open]"), "engineer retirement saved");
  assert.equal((await state()).equipment.find(row => row.id === engineerKit.id).condition, "retired"); checks++;
  await shot("ped-engineer-equipment-en-dark");
  console.log("PED engineer role label, same-department approval, equipment management, issue and return passed.");
  stage = "production operator";
  const operator = "qa.ui.op." + Date.now(); await adminApi("users", { username: operator, name: "Ben", email: "", department: "Production / Line A", role: "employee", password });
  const operatorKitName = "Line A Validation Kit " + Date.now();
  await adminApi("equipment", { ...kit, code: undefined, name: operatorKitName, condition: "ready" });
  const operatorKit = (await adminApi("state", undefined, "GET")).equipment.find(row => row.name === operatorKitName);
  await go("settings"); await click("Sign out"); await until(() => !!document.querySelector('[name="username"]'), "sign out"); await shot("login-en-dark-390", 390, 844); await field("username", operator); await field("password", password); await click("Sign in"); await until(() => !!document.querySelector(".settings-form"), "forced password change");
  assert(await page.eval(() => [...document.querySelectorAll('.settings-form input[autocomplete="new-password"]')].every(input => input.minLength === 6 && input.maxLength === 128))); checks++;
  await field("currentPassword", password); await field("newPassword", newPassword); await fill('.settings-form input[autocomplete="new-password"]', newPassword, 1); await click("Save account changes"); await until(() => document.querySelector(".sheet h1")?.textContent === "dashboard", "operator activated"); assert.equal(await page.eval(() => document.querySelector(".top-avatar .avatar").textContent), "Ben"); checks++;
  assert(!(await page.eval(() => document.querySelector(".sidebar nav").textContent.includes("PED approval center")))); assert(!(await page.eval(() => document.querySelector(".sidebar nav").textContent.includes("Members & permissions")))); checks += 2;
  await newBorrow(operatorKit.id, "Production functional test on Line A"); await click("Submit production request"); await until(() => location.hash === "#loans/pending" && !document.querySelector("dialog[open]"), "operator request"); current = await state(); assert(current.loans.length === 1 && current.loans.every(loan => loan.user_id === current.user.id)); checks++;
  const operatorLoan = current.loans[0]; assert.equal(operatorLoan.production_line, "FCT-02"); assert.equal(operatorLoan.work_order, ""); checks += 2;
  stage = "operator request full lifecycle";
  await go("settings"); await click("Sign out"); await until(() => !!document.querySelector('[name="username"]'), "admin sign-in for operator request");
  await field("username", auth.username); await field("password", auth.password); await click("Sign in"); await until(() => document.querySelector(".sheet h1")?.textContent === "dashboard", "admin review dashboard");
  await go("approvals"); await rowAction(operatorKitName, "Review"); await field("note", "Fixture FCT-02 production request approved"); await click("Approve request"); await until(() => !document.querySelector("dialog[open]"), "operator request approved");
  assert.equal((await state()).loans.find(row => row.id === operatorLoan.id).status, "approved"); checks++;
  await go("loans/approved"); await rowAction(operatorKitName, "Issue"); await until(() => !!document.querySelector(".checklist"), "operator kit issue checklist");
  await page.eval(() => document.querySelectorAll(".check-identity input").forEach(input => input.click())); await field("note", "All five component types verified for fixture FCT-02"); await click("Confirm box issue"); await until(() => !document.querySelector("dialog[open]"), "operator kit issued");
  assert.equal((await state()).loans.find(row => row.id === operatorLoan.id).status, "borrowed"); checks++;
  await go("loans/borrowed"); await rowAction(operatorKitName, "Return"); await until(() => !!document.querySelector(".checklist"), "operator kit return checklist");
  await page.eval(() => document.querySelectorAll(".check-identity input").forEach(input => input.click())); await field("note", "Fixture FCT-02 return complete; quantities and serials match"); await click("Confirm return"); await until(() => !document.querySelector("dialog[open]"), "operator kit returned");
  current = await state(); const completedLoan = current.loans.find(row => row.id === operatorLoan.id);
  assert.equal(completedLoan.status, "returned"); assert.equal(completedLoan.production_line, "FCT-02"); assert.equal(completedLoan.work_order, ""); assert.equal(completedLoan.checkout_check.length, 5); assert.equal(completedLoan.return_check.length, 5); assert.equal(current.equipment.find(row => row.id === operatorKit.id).condition, "ready"); checks += 6;
  await go("loans/returned"); await page.eval(id => { const input = document.querySelector("#workspace-search"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, id); input.dispatchEvent(new Event("input", { bubbles: true })); }, operatorKit.code);
  await rowAction(operatorKitName, ""); await until(() => document.querySelector("dialog[open] h2")?.textContent === "Box loan details", "completed fixture details");
  assert(await page.eval(() => [...document.querySelectorAll(".detail-grid small")].some(element => element.textContent === "Fixture"))); assert(!(await page.eval(() => document.querySelector("dialog[open]").textContent.includes("Work order")))); checks += 2;
  await shot("fixture-returned-details-en-dark"); await click("Close"); await fill("#workspace-search", "");
  await go("reports"); assert(await page.eval(() => document.querySelector(".report-grid").textContent.includes("By fixture"))); checks++;
  await go("loans/returned");
  console.log("Production operator request without work order, approval, issue, return inspection and fixture reports passed.");
  await page.eval(() => document.querySelector(".language-toggle").click()); await page.eval(() => document.querySelector(".theme-toggle").click()); await until(() => document.documentElement.lang === "zh-Hant" && document.documentElement.dataset.theme === "light", "restore Chinese light"); await shot("production-request-zh-light-390", 390, 844);
  assert.equal(page.consoleErrors.length, 0, JSON.stringify(page.consoleErrors)); assert.equal(external.size, 0); checks += 2;
  writeFileSync(`${out}/report.json`, JSON.stringify({ ok: true, checks, findings, externalRequests: [...external], consoleErrors: page.consoleErrors }, null, 2));
  console.log(JSON.stringify({ ok: true, checks, externalRequests: [...external], consoleErrors: page.consoleErrors, screenshots: out, findings }));
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, format: "png" }).catch(() => {});
  console.error("Failed stage:", stage); throw error;
} finally { await browser.close(); }

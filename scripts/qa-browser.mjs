// Local visual/interaction QA fallback. The in-app Browser service is unavailable.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.env.BFT_TASTE_ROOT;
if (!root)
  throw new Error("Set BFT_TASTE_ROOT to the installed taste-skill directory.");
const { Browser } = await import(
  pathToFileURL(root + "/scripts/lib/cdp.mjs").href
);
const { probe, layout, app } = await import(
  pathToFileURL(root + "/scripts/lib/probe.mjs").href
);
const { judge, judgeLayout, judgeApp, APP_SKIP } = await import(
  pathToFileURL(root + "/scripts/lib/rules.mjs").href
);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
console.log("Ready for local QA credentials (hidden).");
const input = await new Promise((resolve) => {
  let value = "";
  const onData = (chunk) => {
    value += chunk.toString();
    if (/[\r\n]/.test(value)) {
      process.stdin.off("data", onData);
      process.stdin.pause();
      resolve(value.trim());
    }
  };
  process.stdin.on("data", onData);
});
const auth = JSON.parse(input);
const base = "http://127.0.0.1:5173",
  out = ".taste-skill/qa";
mkdirSync(out, { recursive: true });
if (process.env.BFT_RESEED_PREVIEW === "1") {
  const login = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(auth),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const result = await fetch(base + "/api/sample", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    body: "{}",
  });
  assert.equal(result.status, 200, "Local sample reseed failed");
}
const browser = await Browser.launch();
const page = await browser.newPage({ width: 1440, height: 1000 });
let checks = 0;
const report = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    if (await page.eval(fn)) {
      checks++;
      return;
    }
    await pause(100);
  }
  throw new Error("Timeout: " + label);
}
async function click(text, selector = "button") {
  const ok = await page.eval(
    ({ text, selector }) => {
      const el = [...document.querySelectorAll(selector)].find(
        (e) => e.textContent.trim() === text,
      );
      if (!el) return false;
      el.click();
      return true;
    },
    { text, selector },
  );
  assert(ok, "Missing control: " + text);
  checks++;
  await pause(150);
}
async function fill(name, value) {
  await page.eval(
    ({ name, value }) => {
      const el =
        document.querySelector(`dialog[open] [name="${name}"]`) ||
        document.querySelector(`[name="${name}"]`);
      const proto =
        el.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : el.tagName === "SELECT"
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { name, value },
  );
}
try {
  await page.goto(base, { settleMs: 1000 });
  await until(
    () => !!document.querySelector("input[name=username]"),
    "login form",
  );
  await fill("username", auth.username);
  await fill("password", auth.password);
  await click("登入工作空間");
  await until(() => !!document.querySelector(".sheet"), "dashboard");
  await page.eval(() => document.fonts.ready.then(() => true));
  for (const width of [1440, 768, 390, 375]) {
    await page.setViewport({
      width,
      height: width >= 1000 ? 1000 : width >= 600 ? 1024 : 844,
      mobile: width < 600,
    });
    await pause(200);
    const m = await page.eval(probe),
      l = await page.eval(layout),
      a = await page.eval(app);
    const findings = [
      ...judge(m, { appMode: true }),
      ...judgeLayout(l),
      ...judgeApp(a, m),
    ].filter((f) => !APP_SKIP.has(f.id));
    report.push({ width, findings, metrics: m, layout: l, app: a });
    const overflow = await page.eval(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      h1: document.querySelector("main h1")?.textContent,
    }));
    assert(
      overflow.scroll <= overflow.width + 1,
      `Page overflow at ${width}: ${JSON.stringify(overflow)}`,
    );
    checks++;
    await page.screenshot({
      path: `${out}/dashboard-${width}.png`,
      format: "png",
      fullPage: true,
    });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  for (const [id, title] of [
    ["equipment", "設備資產"],
    ["loans", "借還管理"],
    ["approvals", "簽核中心"],
    ["reports", "設備使用分析"],
    ["users", "成員與權限"],
    ["audit", "操作紀錄"],
    ["settings", "帳號與設定"],
  ]) {
    await page.eval((id) => (location.hash = id), id);
    await until(() => !!document.querySelector("main h1"), title);
    await pause(100);
    assert.equal(
      await page.eval(() => document.querySelector("main h1").textContent),
      title,
    );
    checks++;
    await page.screenshot({
      path: `${out}/${id}-1440.png`,
      format: "png",
      fullPage: true,
    });
  }
  await page.eval(() => (location.hash = "equipment"));
  await pause(200);
  const searchLabel = "搜尋設備名稱、編號或位置";
  await page.eval((label) => {
    const el = document.querySelector(`[aria-label="${label}"]`);
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, "沒有這台設備");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, searchLabel);
  await until(
    () => document.body.textContent.includes("沒有符合條件的設備"),
    "filtered empty state",
  );
  await page.eval(() =>
    document.querySelector('[aria-label="清除搜尋"]').click(),
  );
  await until(
    () => !!document.querySelector(".equipment-table tbody tr"),
    "clear filter",
  );
  await click("新增設備");
  await until(
    () => !!document.querySelector("dialog[open]"),
    "equipment dialog",
  );
  await fill("name", "介面測試攝影機");
  await fill("code", "UI-" + Date.now());
  await fill("location", "總部・測試庫房");
  await click("儲存設備");
  await until(() => !document.querySelector("dialog[open]"), "equipment saved");
  await until(
    () => document.body.textContent.includes("設備已新增"),
    "equipment saved feedback",
  );
  await page.eval(() => (location.hash = "approvals"));
  await pause(200);
  await click("簽核");
  await until(
    () => !!document.querySelector("dialog[open]"),
    "approval dialog",
  );
  await fill("note", "介面測試：確認用途，核准借用。");
  await click("確認核准");
  await until(() => !document.querySelector("dialog[open]"), "approval saved");
  checks++;
  await page.eval(() => (location.hash = "loans"));
  await pause(200);
  await click("辦理歸還");
  await until(() => !!document.querySelector("dialog[open]"), "return dialog");
  await fill("note", "介面測試：外觀與功能正常，配件完整。");
  await click("確認歸還");
  await until(() => !document.querySelector("dialog[open]"), "return saved");
  checks++;
  await page.eval(() => (location.hash = "dashboard"));
  await pause(200);
  await click("新增借用申請");
  await until(() => !!document.querySelector("dialog[open]"), "borrow dialog");
  await page.screenshot({ path: `${out}/borrow-dialog.png`, format: "png" });
  await page.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await page.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await until(
    () => !document.querySelector("dialog[open]"),
    "Escape closes dialog",
  );
  await page.setViewport({ width: 375, height: 812, mobile: true });
  await pause(150);
  await page.eval(() =>
    document.querySelector('[aria-label="開啟導覽"]').click(),
  );
  await until(
    () => document.querySelector(".sidebar").classList.contains("open"),
    "mobile navigation",
  );
  await click("設備資產");
  await until(
    () => document.querySelector("main h1")?.textContent === "設備資產",
    "mobile navigation equipment",
  );
  assert(
    !(await page.eval(() =>
      document.querySelector(".sidebar").classList.contains("open"),
    )),
  );
  checks++;
  await page.screenshot({
    path: `${out}/equipment-375.png`,
    format: "png",
    fullPage: true,
  });
  await page.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await page.eval(() => (location.hash = "dashboard"));
  await pause(200);
  assert(
    await page.eval(
      () => document.querySelector("h1").getBoundingClientRect().height > 0,
    ),
  );
  checks++;
  assert.equal(
    page.consoleErrors.length,
    0,
    JSON.stringify(page.consoleErrors),
  );
  checks++;
  writeFileSync(
    `${out}/report.json`,
    JSON.stringify(
      { checks, viewports: report, consoleErrors: page.consoleErrors },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      ok: true,
      checks,
      consoleErrors: page.consoleErrors,
      findings: report.map((r) => ({ width: r.width, findings: r.findings })),
      screenshots: out,
    }),
  );
} finally {
  await browser.close();
}

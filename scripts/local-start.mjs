import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureToolEnvironment } from "./tool-environment.mjs";
import { lanUrls, listenHost } from "./local-network.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
configureToolEnvironment(root);
const options = {
  port: 3000,
  lan: false,
  open: false,
  backup: false,
  stop: false,
  dataDir: path.join(root, "data"),
};
for (let i = 2; i < process.argv.length; i++) {
  const argument = process.argv[i];
  if (argument === "--lan") options.lan = true;
  else if (argument === "--open") options.open = true;
  else if (argument === "--backup") options.backup = true;
  else if (argument === "--stop") options.stop = true;
  else if (argument === "--port") options.port = Number(process.argv[++i]);
  else if (argument === "--data-dir") {
    const value = process.argv[++i];
    if (!value || value.startsWith("--"))
      throw new Error("--data-dir 需要資料夾路徑。");
    options.dataDir = path.resolve(root, value);
  } else throw new Error(`不支援的選項：${argument}`);
}
if (
  !Number.isInteger(options.port) ||
  options.port < 1024 ||
  options.port > 65535
)
  throw new Error("連接埠必須介於 1024–65535。");
if (options.dataDir === root)
  throw new Error("資料庫需使用獨立資料夾，不能使用專案根目錄。");
const dataDir = options.dataDir;
const stateDir = path.join(dataDir, "state");
const lockFile = path.join(dataDir, ".running.json");
const instanceFile = path.join(dataDir, ".instance.json");
const url = `http://127.0.0.1:${options.port}`;
const host = listenHost(options.lan);
function showLanUrls() {
  if (options.lan) for (const address of lanUrls(options.port)) console.log(`區域網網址 / LAN URL: ${address}`);
}
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const localEnv = {
  ...process.env,
  CI: "true",
  CLOUDFLARE_CF_FETCH_ENABLED: "false",
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_WRITE_LOGS: "false",
  NO_UPDATE_NOTIFIER: "1",
};
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
let child;
let ownsLock = false;
let stopping = false;
function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
function releaseLock() {
  if (
    ownsLock &&
    existsSync(lockFile) &&
    readJson(lockFile).pid === process.pid
  )
    unlinkSync(lockFile);
  ownsLock = false;
}
function openBrowser() {
  const args =
    process.platform === "win32"
      ? [url]
      : process.platform === "darwin"
        ? [url]
        : [url];
  const executable =
    process.platform === "win32"
      ? "explorer.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const opener = spawn(executable, args, {
    windowsHide: true,
    detached: true,
    stdio: "ignore",
  });
  opener.on("error", () => console.log(`請在瀏覽器開啟 ${url}`));
  opener.unref();
}
async function health(base = url) {
  try {
    const response = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(700),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
function run(args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, {
      cwd: root,
      env: localEnv,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (bytes) => {
      output += bytes.toString();
      if (!quiet) process.stdout.write(bytes);
    });
    child.stderr.on("data", (bytes) => {
      output += bytes.toString();
      if (!quiet) process.stderr.write(bytes);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      child = undefined;
      if (code === 0) resolve(output);
      else
        reject(
          new Error(
            stopping
              ? "系統已停止。"
              : `執行失敗（${signal || code}）。${quiet ? "\n" + output : "請查看上方訊息。"}`,
          ),
        );
    });
  });
}
async function availablePort() {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `${url} 已被其他程式使用。請改用 --port 3001，或先關閉占用程式。`,
        ),
      ),
    );
    probe.listen(options.port, host, () => probe.close(resolve));
  });
}
function sourceFingerprint() {
  const hash = createHash("sha256");
  function add(file) {
    if (!existsSync(file)) return;
    // QA harness changes do not alter the application bundle or require a rebuild.
    if (path.dirname(file) === path.join(root, "scripts") && /^(qa-|test-)/.test(path.basename(file))) return;
    const relative = path.relative(root, file);
    if (readdirOrNull(file)) {
      for (const entry of readdirSync(file).sort()) add(path.join(file, entry));
    } else hash.update(relative).update(readFileSync(file));
  }
  for (const name of [
    "app",
    "components",
    "hooks",
    "lib",
    "worker",
    "public",
    "vendor",
    "db",
    "drizzle",
    "scripts",
    "vite.config.ts",
    "next.config.ts",
    "postcss.config.mjs",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".openai/hosting.json",
  ])
    add(path.join(root, name));
  return hash.digest("hex");
}
function readdirOrNull(file) {
  try {
    readdirSync(file);
    return true;
  } catch (error) {
    if (error.code === "ENOTDIR") return false;
    throw error;
  }
}
async function ensureDependencies() {
  if (
    existsSync(wrangler) &&
    existsSync(path.join(root, "node_modules/vinext/dist/cli.js")) &&
    existsSync(path.join(root, "node_modules/@fontsource/noto-sans-tc/400.css"))
  )
    return;
  const candidates = [
    process.env.npm_execpath,
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
    path.resolve(
      path.dirname(process.execPath),
      "../lib/node_modules/npm/bin/npm-cli.js",
    ),
  ];
  const npm = candidates.find(
    (candidate) =>
      candidate && candidate.endsWith("npm-cli.js") && existsSync(candidate),
  );
  if (!npm)
    throw new Error(
      "找不到網站套件。請先在專案目錄執行 npm run install:ci，再重新啟動。",
    );
  console.log("首次使用：正在安裝網站套件（這一步需要網路）…");
  await run([npm, "run", "install:ci"]);
}
async function stopExisting() {
  if (!existsSync(lockFile)) {
    console.log("本機系統目前未執行。");
    return;
  }
  const lock = readJson(lockFile);
  if (alive(lock.pid)) {
    const result = await health(`http://127.0.0.1:${lock.port}`);
    if (
      result?.application !== "bft-equipment" ||
      result.instance !== readJson(instanceFile).id
    ) {
      throw new Error(
        "無法確認執行中的本機系統。若仍在啟動中，請稍後再試，或在原啟動視窗按 Ctrl+C。",
      );
    }
    if (process.platform === "win32") {
      await new Promise((resolve, reject) => {
        const killer = spawn(
          "taskkill.exe",
          ["/PID", String(lock.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.once("error", reject);
        killer.once("exit", (code) =>
          code === 0
            ? resolve()
            : reject(new Error("無法停止系統，請在原啟動視窗按 Ctrl+C。")),
        );
      });
    } else process.kill(lock.pid, "SIGTERM");
    for (let i = 0; i < 30 && alive(lock.pid); i++) await pause(100);
    if (alive(lock.pid))
      throw new Error("系統尚未停止，請在原啟動視窗按 Ctrl+C。");
  }
  if (existsSync(lockFile) && readJson(lockFile).pid === lock.pid)
    unlinkSync(lockFile);
  console.log("本機系統已停止，資料保留於原資料夾。");
}
function backup() {
  if (!existsSync(stateDir))
    throw new Error("尚未建立本機資料庫，請先啟動系統。");
  if (existsSync(lockFile) && alive(readJson(lockFile).pid))
    throw new Error("請先關閉本機系統，再執行備份，以保持資料庫一致。");
  const target = path.join(
    dataDir,
    "backups",
    new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-"),
  );
  mkdirSync(target, { recursive: true });
  cpSync(stateDir, path.join(target, "state"), { recursive: true });
  if (existsSync(instanceFile))
    cpSync(instanceFile, path.join(target, ".instance.json"));
  cpSync(path.join(root, "drizzle"), path.join(target, "schema"), {
    recursive: true,
  });
  console.log(`備份已完成：${target}\n請妥善保存整個備份資料夾。`);
}
async function stop() {
  if (stopping) return;
  stopping = true;
  if (child) {
    const running = child;
    const exited = new Promise((resolve) => running.once("exit", resolve));
    if (process.platform === "win32") {
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(running.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" },
      );
      killer.on("error", () => running.kill());
    } else running.kill("SIGTERM");
    await Promise.race([exited, pause(5000)]);
  }
  releaseLock();
}
process.once("SIGINT", () => {
  void stop();
});
process.once("SIGTERM", () => {
  void stop();
});
process.once("exit", releaseLock);

try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13))
    throw new Error("需要 Node.js 22.13 以上版本，建議使用 Node.js 24。");
  if (options.stop) {
    await stopExisting();
  } else if (options.backup) {
    backup();
  } else {
    mkdirSync(dataDir, { recursive: true });
    if (!existsSync(instanceFile)) {
      try {
        writeFileSync(instanceFile, JSON.stringify({ id: randomUUID() }), {
          flag: "wx",
        });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    const instance = readJson(instanceFile).id;
    const existing = await health();
    if (
      existing?.application === "bft-equipment" &&
      existing.instance === instance
    ) {
      const lock = existsSync(lockFile) ? readJson(lockFile) : null;
      if (options.lan && lock?.host !== "0.0.0.0")
        throw new Error("目前以本機模式執行。請先停止系統，再使用 --lan 或 START system.cmd 啟動。");
      console.log(`本機系統已在執行：${url}`);
      showLanUrls();
      if (options.open) openBrowser();
    } else {
      if (existsSync(lockFile)) {
        const lock = readJson(lockFile);
        if (alive(lock.pid))
          throw new Error(
            `此資料庫已由另一個本機系統使用（連接埠 ${lock.port}）。請先關閉原本的啟動視窗。`,
          );
        unlinkSync(lockFile);
      }
      await availablePort();
      writeFileSync(
        lockFile,
        JSON.stringify({
          pid: process.pid,
          port: options.port,
          host,
          started: new Date().toISOString(),
        }),
        { flag: "wx" },
      );
      ownsLock = true;
      await ensureDependencies();
      const fingerprint = sourceFingerprint();
      const buildStamp = path.join(root, ".sites-runtime/local-build.json");
      if (
        !existsSync(path.join(root, "dist/server/wrangler.json")) ||
        !existsSync(buildStamp) ||
        readJson(buildStamp).fingerprint !== fingerprint
      ) {
        console.log("正在準備本機網站…");
        await run([path.join(root, "scripts/run-framework.mjs"), "build"], {
          quiet: true,
        });
        mkdirSync(path.dirname(buildStamp), { recursive: true });
        writeFileSync(buildStamp, JSON.stringify({ fingerprint }));
      }
      const configuration = readJson(
        path.join(root, "dist/server/wrangler.json"),
      );
      configuration.vars = {
        ...configuration.vars,
        BFT_LOCAL_INSTANCE: instance,
      };
      configuration.d1_databases = [
        {
          binding: "DB",
          database_name: "bft-equipment-local",
          database_id: "00000000-0000-4000-8000-000000000000",
          migrations_dir: "../../drizzle",
        },
      ];
      configuration.services = [];
      configuration.observability = { enabled: false };
      const localConfig = path.join(
        root,
        `dist/server/wrangler.local-${options.port}.json`,
      );
      writeFileSync(localConfig, JSON.stringify(configuration, null, 2));
      console.log("正在檢查本機資料表…");
      await run(
        [
          "--import",
          "./scripts/sites-env.mjs",
          wrangler,
          "d1",
          "migrations",
          "apply",
          "DB",
          "--local",
          "--config",
          localConfig,
          "--persist-to",
          stateDir,
        ],
        { quiet: true },
      );
      console.log("本機資料表已就緒。");
      console.log(
        `\n資料儲存位置：${stateDir}\n啟動後請保持此視窗開啟；按 Ctrl+C 可停止系統。\n`,
      );
      const server = run([
        path.join(root, "scripts/local-server.mjs"),
        String(options.port),
        stateDir,
        instance,
        host,
      ]);
      // Attach the rejection handler immediately so a failed startup cannot escape readiness polling.
      let serverFailure;
      server.catch((error) => {
        serverFailure = error;
      });
      let ready = false;
      for (let i = 0; i < 150; i++) {
        if (serverFailure) throw serverFailure;
        if (stopping) break;
        const result = await health();
        if (
          result?.application === "bft-equipment" &&
          result.instance === instance
        ) {
          ready = true;
          break;
        }
        await pause(200);
      }
      if (!ready && !stopping)
        throw new Error("網站啟動逾時，請查看上方錯誤訊息。");
      if (ready) {
        console.log(
          `\nBFT 本機設備系統已就緒：${url}\n首次使用請建立管理員帳號；已有帳號請直接登入。\n`,
        );
        showLanUrls();
        if (options.open) openBrowser();
      }
      await server;
      releaseLock();
    }
  }
} catch (error) {
  if (!stopping) {
    console.error(`\n無法完成：${error.message}`);
    process.exitCode = 1;
  }
  await stop();
}

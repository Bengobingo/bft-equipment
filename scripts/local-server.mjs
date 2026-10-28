import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { Miniflare, Log, LogLevel } from "miniflare";

// Run the already-built application directly: no file watcher or development proxy.
const root = fileURLToPath(new URL("../", import.meta.url));
const [port, stateDirectory, instance, host = "127.0.0.1"] = process.argv.slice(2);
if (!["127.0.0.1", "0.0.0.0"].includes(host)) throw new Error("不支援的監聽位址。");
if (!port || !stateDirectory || !instance)
  throw new Error("請使用 local-start.mjs 啟動系統。");
const moduleRoot = path.join(root, "dist/server");
function moduleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? moduleFiles(file)
      : /\.(m?js)$/.test(entry.name)
        ? [file]
        : [];
  });
}
const entrypoint = path.join(moduleRoot, "index.js");
const modules = [
  entrypoint,
  ...moduleFiles(moduleRoot).filter((file) => file !== entrypoint),
].map((file) => ({ type: "ESModule", path: file }));
const runtime = new Miniflare({
  name: "bft-equipment-local",
  host,
  port: Number(port),
  modules,
  modulesRoot: moduleRoot,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  cf: false,
  telemetry: { enabled: false },
  log: new Log(LogLevel.WARN),
  defaultPersistRoot: path.join(stateDirectory, "v3"),
  d1Databases: { DB: "00000000-0000-4000-8000-000000000000" },
  bindings: { BFT_LOCAL_INSTANCE: instance },
  assets: {
    directory: path.join(root, "dist/client"),
    binding: "ASSETS",
    routerConfig: { has_user_worker: true },
  },
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await runtime.dispose();
}
process.once("SIGINT", () => {
  void close();
});
process.once("SIGTERM", () => {
  void close();
});
try {
  await runtime.ready;
  console.log(`本機伺服器已啟動：http://127.0.0.1:${port}${host === "0.0.0.0" ? "（區域網模式 / LAN enabled）" : ""}`);
} catch (error) {
  await close();
  throw error;
}

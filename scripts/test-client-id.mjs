import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
const { outputText } = transpileModule(readFileSync(new URL("../lib/client-id.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } });
const exports = {};
// HTTP LAN pages have getRandomValues, but do not expose secure-context randomUUID.
runInNewContext(outputText, { exports, crypto: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) } });
const identifiers = Array.from({ length: 1000 }, () => exports.clientId());
for (const id of identifiers) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(new Set(identifiers).size, identifiers.length);
console.log("Client IDs passed: 1,000 distinct UUIDs without crypto.randomUUID.");

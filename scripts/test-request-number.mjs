import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ModuleKind, transpileModule } from "typescript";

const source = readFileSync(new URL("../lib/types.ts", import.meta.url), "utf8");
const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext } });
const { requestId } = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
assert.equal(requestId({ created: "2026-08-11T09:50:00.000Z" }), "BR2608111750");
assert.equal(requestId({ created: "2026-08-11T17:50:00+08:00" }), "BR2608111750");
assert.equal(requestId({ created: "2026-08-10T16:00:00.000Z" }), "BR2608110000");
assert.equal(requestId({ created: "2026-12-31T16:01:00.000Z" }), "BR2701010001");
assert.equal(requestId({ created: "2026-08-11T09:50:59.999Z" }), "BR2608111750");
assert.equal(requestId({ created: "2026-08-11T09:51:00.000Z" }), "BR2608111751");
console.log("Request number tests passed: 6 checks (Taipei time, midnight, year boundary and minute format).");

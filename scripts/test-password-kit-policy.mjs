import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
const source = readFileSync(new URL("../lib/security.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validatePassword, hashPassword, verifyPassword } = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));
let checks = 0;
for (const password of ["123456", "abcdef", "!!!!!!", "中文密碼測試", " 1234 ", "      ", "a".repeat(128)]) {
  validatePassword(password);
  const hash = await hashPassword(password);
  assert(await verifyPassword(password, hash));
  assert(!(await verifyPassword(password + "x", hash)));
  checks += 3;
}
for (const password of ["", "12345", "a".repeat(129), null, 123456]) {
  assert.throws(() => validatePassword(password), /6–128/); checks++;
}
const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys=ON; CREATE TABLE equipment(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,created TEXT NOT NULL,name TEXT NOT NULL); CREATE TABLE loans(id TEXT PRIMARY KEY,equipment_id TEXT REFERENCES equipment(id));");
const insert = database.prepare("INSERT INTO equipment VALUES (?,?,?,?)");
insert.run("existing", "PED-0042", "2026-01-01", "Custom short code");
insert.run("auto-a", "PED-KIT-" + "A".repeat(32), "2026-01-02", "Kit A");
insert.run("auto-b", "PED-KIT-" + "B".repeat(32), "2026-01-03", "Kit B");
insert.run("custom", "CUSTOM-LONG-REFERENCE", "2026-01-04", "Custom reference");
insert.run("demo", "PED-KIT-001", "2026-01-05", "Demo reference");
database.prepare("INSERT INTO loans VALUES (?,?)").run("loan-a", "auto-a");
const migration = readFileSync(new URL("../drizzle/0003_short_kit_codes.sql", import.meta.url), "utf8");
database.exec(migration);
const rows = database.prepare("SELECT id,code,name FROM equipment ORDER BY id").all();
const code = id => rows.find(row => row.id === id).code;
assert.equal(code("existing"), "PED-0042");
assert.equal(code("auto-a"), "PED-0043");
assert.equal(code("auto-b"), "PED-0044");
assert.equal(code("custom"), "CUSTOM-LONG-REFERENCE");
assert.equal(code("demo"), "PED-KIT-001");
assert.equal(database.prepare("SELECT equipment_id FROM loans").get().equipment_id, "auto-a");
assert.equal(database.prepare("PRAGMA foreign_key_check").all().length, 0);
checks += 7;
database.exec(migration);
assert.deepEqual(database.prepare("SELECT id,code,name FROM equipment ORDER BY id").all(), rows); checks++;
database.close();
console.log(JSON.stringify({ ok: true, checks, passwordLengthOnly: true, whitespacePreserved: true, shortCodeMigrationAndLoanLinks: true }));

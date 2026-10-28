import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const source = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", source), "utf8"));
const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys=ON");
for (const migration of journal.entries.filter(item => item.idx < 6)) database.exec(readFileSync(new URL(migration.tag + ".sql", source), "utf8"));
database.exec(`
 INSERT INTO users(id,username,name,email,department,role,password,created) VALUES('u','test','Test','','QA','admin','test','2026-10-28');
 INSERT INTO equipment(id,code,name,category,brand,model,serial,location,condition,notes,components,created) VALUES('e','BOX001','Existing box','主機板測試設備箱','','QA','','Storage','ready','', '[]','2026-10-28');
 INSERT INTO loans(id,equipment_id,user_id,department,start,end,purpose,status,created,updated) VALUES('l','e','u','QA','2026-10-28','2026-10-28','Existing loan','approved','2026-10-28','2026-10-28');
`);
const original = { ...database.prepare("SELECT * FROM loans WHERE id='l'").get() };
database.exec(readFileSync(new URL("0006_batch_checkout.sql", source), "utf8"));
const after = { ...database.prepare("SELECT * FROM loans WHERE id='l'").get() };
assert.equal(after.checkout_batch_id, null);
delete after.checkout_batch_id;
assert.deepEqual(after, original);
assert.equal(database.prepare("PRAGMA foreign_key_check").all().length, 0);
assert.equal(database.prepare("SELECT count(*) AS n FROM checkout_batches").get().n, 0);
assert.equal(database.prepare("SELECT count(*) AS n FROM checkout_batch_items").get().n, 0);
assert.throws(() => database.exec("INSERT INTO checkout_batch_items(batch_id,loan_id,status,error,updated) VALUES('missing','l','success','','2026-10-28')"), /FOREIGN KEY/);
database.close();
console.log("Batch migration passed: existing loans preserved and foreign keys valid.");

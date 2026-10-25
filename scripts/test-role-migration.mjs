import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for (const tag of ['0000_far_cyclops','0001_powerful_eternity','0002_ped_equipment_kits','0003_short_kit_codes']) db.exec(readFileSync(new URL(`../drizzle/${tag}.sql`, import.meta.url),'utf8'));
const fixtures = [['operator','employee',1],['engineer','approver',1],['legacy-active','custodian',1],['legacy-disabled','custodian',0],['administrator','admin',1]];
for (const [id,role,active] of fixtures) {
  db.prepare('INSERT INTO users(id,username,name,email,department,role,password,active,must_change,created) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,id,id,'','PED',role,'fixture-hash-preserved',active,0,'2026-01-01');
  db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').run(`fixture-session-${id}`,id,9999999999999);
}
db.exec("INSERT INTO equipment(id,code,name,category,brand,model,serial,location,condition,notes,created) VALUES('kit','PED-0001','Upgrade fixture kit','CPU / DIMM 設備箱','','','','PED','ready','','2026-01-01')");
db.exec("INSERT INTO loans(id,equipment_id,user_id,department,start,end,purpose,status,created,updated,approver_id) VALUES('loan','kit','legacy-active','PED','2026-01-01','2026-01-02','Historical fixture','returned','2026-01-01','2026-01-02','administrator')");
db.exec("INSERT INTO events(id,actor_id,action,target,detail,created) VALUES('event','legacy-active','完成設備歸還','loan','Historical inspection','2026-01-02')");
db.exec("INSERT INTO settings(key,value) VALUES('organization','Fixture workspace')");
db.exec("INSERT INTO login_attempts(key,count,expires) VALUES('fixture',1,9999999999999)");
const rows = table => db.prepare(`SELECT * FROM ${table}`).all();
const originalUsers = rows('users');
const protectedTables = Object.fromEntries(['equipment','loans','events','settings','login_attempts'].map(table => [table,rows(table)]));
const unaffectedSessions = rows('sessions').filter(row => !row.user_id.startsWith('legacy-'));
const migration = readFileSync(new URL('../drizzle/0004_merge_custodian_role.sql',import.meta.url),'utf8');
db.exec(migration);
let checks = 0;
for (const original of originalUsers) {
  const expected = { ...original, role: original.role === 'custodian' ? 'approver' : original.role };
  assert.deepEqual({ ...db.prepare('SELECT * FROM users WHERE id=?').get(original.id) },expected);checks++;
}
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='custodian'").get().n,0);checks++;
assert.deepEqual(rows('sessions'),unaffectedSessions);checks++;
for (const [table,original] of Object.entries(protectedTables)) { assert.deepEqual(rows(table),original);checks++; }
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);checks++;
const after = { users:rows('users'),sessions:rows('sessions') };
db.exec(migration);
assert.deepEqual({users:rows('users'),sessions:rows('sessions')},after);checks++;
db.close();
console.log(JSON.stringify({ok:true,checks,activeAndDisabledAccountsMigrated:true,credentialsAndHistoryPreserved:true,onlyMigratedSessionsRevoked:true,idempotent:true}));

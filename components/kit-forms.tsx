"use client";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { usePreferences } from "./preferences";
import { Badge, Button, ErrorBox, Field, FormFooter, Notice, PartsTable, useLabels } from "./ped-ui";
import { categories, partTypes, taipeiDate, type AppData, type Equipment, type KitPart, type Loan, type PartCheck } from "@/lib/types";

type Common = { busy: boolean; error: string; onClose: () => void; onSave: (body: Record<string, unknown>) => void };
const formBody = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget)); };
function newPart(): KitPart { return { id: crypto.randomUUID(), type: "CPU", name: "", partNumber: "", serial: "", quantity: 1 }; }

export function BoxForm({ equipment, ...props }: Common & { equipment?: Equipment }) {
  const { tx } = usePreferences(); const labels = useLabels();
  const [parts, setParts] = useState<KitPart[]>(() => equipment?.components.length ? equipment.components : []);
  const update = (id: string, changes: Partial<KitPart>) => setParts(rows => rows.map(row => row.id === id ? { ...row, ...changes } : row));
  const options = equipment && !categories.includes(equipment.category) ? [equipment.category, ...categories] : categories;
  return <form onSubmit={event => props.onSave({ ...formBody(event), components: parts })}>
    <div className="dialog-body"><ErrorBox message={props.error} />
      <div className="form-grid">
        <Field className="kit-name-field" label={tx("設備箱名稱", "Kit name")}><input name="name" defaultValue={equipment?.name} required maxLength={100} placeholder={tx("例如：Server 主機板測試箱 A", "e.g. Server mainboard kit A")} /></Field>
        <Field label={tx("設備箱類別", "Kit category")}><select name="category" defaultValue={equipment?.category || categories[0]}>{options.map(value => <option key={value} value={value}>{labels.category(value)}</option>)}</select></Field>
        <Field label={tx("對應平台／機種", "Platform / model")}><input name="model" defaultValue={equipment?.model || ""} maxLength={100} placeholder="Server / Platform" /></Field>
        <Field label={tx("保管位置", "Storage location")}><input name="location" defaultValue={equipment?.location} required maxLength={100} placeholder="PED / Rack A-01" /></Field>
        <Field label={tx("設備箱狀態", "Kit condition")}><select name="condition" defaultValue={equipment?.condition || "ready"}>{["ready", "maintenance", "retired"].map(value => <option key={value} value={value}>{labels.status(value)}</option>)}</select></Field>
      </div>
      <div className="section-heading"><div><h3>{tx("箱內零件清單", "Component manifest")}</h3><p>{tx("登錄料號、序號及數量；每次借用會保存當時的清單。", "Register P/N, S/N and quantity. Each request saves its own manifest snapshot.")}</p></div><Button disabled={props.busy || parts.length >= 80} onClick={() => setParts(rows => [...rows, newPart()])}><Plus size={16} />{tx("新增零件", "Add component")}</Button></div>
      {!parts.length && <Notice>{tx("請至少新增一項零件，才能完成設備箱建檔。", "Add at least one component to register this kit.")}</Notice>}
      <div className="component-editor">{parts.map((part, index) => <fieldset key={part.id} className="component-row"><legend>{tx("零件", "Component")} {index + 1}</legend>
        <Field label={tx("類別", "Type")}><select aria-label={tx("零件類別", "Component type")} value={part.type} onChange={e => update(part.id, { type: e.target.value as KitPart["type"] })}>{partTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
        <Field label={tx("名稱／規格", "Name / specification")}><input aria-label={tx("零件名稱", "Component name")} value={part.name} required maxLength={100} onChange={e => update(part.id, { name: e.target.value })} /></Field>
        <Field label={tx("料號 P/N", "Part number")}><input value={part.partNumber} maxLength={100} onChange={e => update(part.id, { partNumber: e.target.value })} /></Field>
        <Field label={tx("序號 S/N", "Serial number")}><input value={part.serial} maxLength={100} onChange={e => update(part.id, { serial: e.target.value })} /></Field>
        <Field label={tx("數量", "Quantity")}><input type="number" min={1} max={10000} required value={part.quantity} onChange={e => update(part.id, { quantity: Number(e.target.value) })} /></Field>
        <button type="button" className="icon-button danger" aria-label={tx(`移除第 ${index + 1} 項零件`, `Remove component ${index + 1}`)} onClick={() => setParts(rows => rows.filter(row => row.id !== part.id))}><Trash2 size={17} /></button>
      </fieldset>)}</div>
      <Notice>{tx("有待簽核、待借出或使用中的申請時，箱內清單會鎖定。需先結束相關申請，才能更換零件或轉為維護。", "Active requests lock the manifest. Complete or cancel them before replacing components or placing the kit in maintenance.")}</Notice>
      <Field label={tx("工程備註", "Engineering notes")}><textarea name="notes" defaultValue={equipment?.notes || ""} maxLength={1000} rows={3} /></Field>
    </div><FormFooter busy={props.busy} disabled={!parts.length} label={tx("儲存設備箱", "Save kit")} onClose={props.onClose} />
  </form>;
}

export function BorrowForm({ data, equipment, conflictLoanId, onExisting, ...props }: Common & { data: AppData; equipment?: Equipment; conflictLoanId?: string; onExisting: (id: string) => void }) {
  const { tx } = usePreferences(); const labels = useLabels();
  const [kitId, setKitId] = useState(equipment?.id || "");
  const [start, setStart] = useState(taipeiDate()); const [end, setEnd] = useState(taipeiDate());
  const kit = data.equipment.find(row => row.id === kitId);
  const active = data.loans.filter(row => row.equipment_id === kitId && ["pending", "approved", "borrowed"].includes(row.status));
  return <form onSubmit={event => props.onSave(formBody(event))}><div className="dialog-body">
    <ErrorBox message={props.error} />{conflictLoanId && <Button disabled={props.busy} onClick={() => onExisting(conflictLoanId)}>{tx("查看原借用申請", "Open existing request")}<ArrowUpRight size={16} /></Button>}
    <Notice>{tx(`以整箱為單位借用，須由 PED 審核及點交。最長 ${data.settings.maxDays} 天。`, `Request a complete kit. PED approval and itemized handover are required. Maximum ${data.settings.maxDays} days.`)}</Notice>
    <Field label={tx("選擇設備箱", "Select a kit")}><select name="equipment_id" value={kitId} required onChange={event => setKitId(event.target.value)}><option value="" disabled>{tx("請選擇生產所需的設備箱", "Choose a kit for production")}</option>{data.equipment.filter(row => row.condition === "ready").map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}{row.busy ? tx("（使用中）", " (issued)") : ""}</option>)}</select></Field>
    {kit && <div className="kit-context"><div className="section-heading"><div><strong>{kit.name}</strong><p>{kit.model || "—"} · {kit.location}</p></div><span className="mono">{kit.code}</span></div><PartsTable parts={kit.components} />
      {!!active.length && <div className="reserved-windows"><strong>{tx("已保留時段", "Reserved dates")}</strong>{active.map(row => <div key={row.id}><span>{labels.date(row.start)} – {labels.date(row.end)}</span><Badge status={row.status} />{row.user_id === data.user.id && <button type="button" className="text-button" onClick={() => onExisting(row.id)}>{tx("查看我的申請", "My request")}</button>}</div>)}</div>}
      {data.user.role === "employee" && <p className="help">{tx("其他產線的時段由系統於送出時檢查，不會公開同仁的申請內容。", "Other production reservations are checked on submission without exposing colleagues' request details.")}</p>}
    </div>}
    <div className="form-grid">
      <Field label={tx("借用日期", "Start date")}><input type="date" name="start" min={taipeiDate()} value={start} onChange={event => { setStart(event.target.value); if (event.target.value > end) setEnd(event.target.value); }} required /></Field>
      <Field label={tx("預計歸還日期", "Expected return")}><input type="date" name="end" min={start} value={end} onChange={event => setEnd(event.target.value)} required /></Field>
      <Field label={tx("站別", "Fixture")}><input name="production_line" required maxLength={60} placeholder="FCT-02" /></Field>
      <Field label={tx("生產機種／平台", "Product model / platform")}><input name="product_model" maxLength={100} placeholder={kit?.model || "Server platform"} /></Field>
    </div>
    <Field label={tx("生產用途說明", "Production purpose")}><textarea name="purpose" required maxLength={1000} rows={3} placeholder={tx("例如：主機板功能測試、CPU / DIMM 驗證、試產或重工測試", "e.g. Mainboard functional test, CPU / DIMM validation, pilot build or rework")} /></Field>
    <p className="borrower-line">{tx("申請人", "Requested by")}：{data.user.name} · {data.user.department}</p>
    {kit && !kit.components.length && <Notice>{tx("此設備箱尚未有零件清單，請先聯絡 PED 完成建檔。", "Contact PED to register the component manifest before requesting this kit.")}</Notice>}
  </div><FormFooter busy={props.busy} disabled={!kit || !kit.components.length} label={tx("送出借用申請", "Submit production request")} onClose={props.onClose} /></form>;
}

export type LoanAction = "approve" | "reject" | "checkout" | "return" | "cancel";
export function ActionForm({ loan, action, ...props }: Common & { loan: Loan; action: LoanAction }) {
  const { tx } = usePreferences();
  const [checks, setChecks] = useState<PartCheck[]>(() => loan.manifest.map(part => ({ id: part.id, quantity: part.quantity, condition: "ok", checked: false })));
  const handover = action === "checkout" || action === "return";
  const update = (id: string, changes: Partial<PartCheck>) => setChecks(rows => rows.map(row => row.id === id ? { ...row, ...changes } : row));
  const labels = { approve: tx("確認核准", "Approve request"), reject: tx("確認駁回", "Reject request"), checkout: tx("確認點交借出", "Confirm kit issue"), return: tx("確認歸還清點", "Confirm return"), cancel: tx("確認取消申請", "Cancel request") };
  return <form onSubmit={event => props.onSave({ ...formBody(event), ...(handover ? { checklist: checks } : {}) })}><div className="dialog-body"><ErrorBox message={props.error} />
    <div className="decision-summary"><strong>{loan.equipment_name}</strong><span>{loan.code} · {loan.user_name} · {loan.production_line || loan.department}</span>{loan.work_order && <span className="mono">{loan.work_order}</span>}</div>
    {handover && <><Notice>{action === "checkout" ? tx("請核對料號、序號與數量，再逐項勾選確認。必須全數齊全正常才能借出。", "Verify P/N, S/N and quantity, then check each entry. All components must be complete and working before issue.") : tx("逐項記錄實際歸還數量與狀況。有缺件或損壞時，設備箱將轉為待維護／補件。", "Record actual quantities and conditions. Any missing or damaged component places the kit in maintenance.")}</Notice>
      {!loan.manifest.length && <Notice>{tx("此為舊版建立的歷史申請，沒有零件快照，請於檢查紀錄說明實際點交內容。", "This historical request has no manifest snapshot. Describe the physical contents in the inspection note.")}</Notice>}
      <div className="checklist">{loan.manifest.map((part, index) => <div className="check-row" key={part.id}>
        <label className="check-identity"><input type="checkbox" checked={checks[index].checked} onChange={e => update(part.id, { checked: e.target.checked })} /><span><strong>{part.type} · {part.name}</strong><small className="mono">P/N {part.partNumber || "—"} · S/N {part.serial || "—"}</small><small>{tx("應有數量", "Expected")}: {part.quantity}</small></span></label>
        {action === "return" ? <div className="check-controls"><Field label={tx("實還數量", "Returned qty")}><input type="number" min={0} max={part.quantity} value={checks[index].quantity} required onChange={e => update(part.id, { quantity: Number(e.target.value), ...(Number(e.target.value) < part.quantity ? { condition: "missing" as const } : {}) })} /></Field><Field label={tx("零件狀況", "Condition")}><select value={checks[index].condition} onChange={e => update(part.id, { condition: e.target.value as PartCheck["condition"] })}><option value="ok">{tx("正常", "OK")}</option><option value="missing">{tx("缺件", "Missing")}</option><option value="damaged">{tx("損壞", "Damaged")}</option></select></Field></div> : <span className="mono">× {part.quantity}</span>}
      </div>)}</div>
    </>}
    {!handover && <div className="detail-purpose"><small>{tx("生產用途", "Production purpose")}</small><p>{loan.purpose}</p></div>}
    <Field label={action === "return" ? tx("歸還檢查紀錄（必填）", "Return inspection note (required)") : action === "reject" ? tx("駁回原因（必填）", "Rejection reason (required)") : tx("工程處理備註", "Engineering note")}><textarea name="note" required={action === "return" || action === "reject"} rows={3} maxLength={1000} /></Field>
    {handover && !!loan.manifest.length && <p className="help">{tx(`已確認 ${checks.filter(row => row.checked).length} / ${checks.length} 項零件`, `${checks.filter(row => row.checked).length} / ${checks.length} components checked`)}</p>}
  </div><FormFooter busy={props.busy} disabled={handover && checks.some(row => !row.checked)} label={labels[action]} onClose={props.onClose} /></form>;
}

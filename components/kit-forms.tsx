"use client";
import { ReturnSelfCheck } from "./return-history";
import { clientId } from "@/lib/client-id";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { usePreferences } from "./preferences";
import { Badge, Button, ErrorBox, Field, FormFooter, Notice, PartsTable, requestId, useLabels } from "./ped-ui";
import { categories, partTypes, canRequestEquipment, taipeiDate, type AppData, type Equipment, type KitPart, type Loan, type PartCheck } from "@/lib/types";

type Common = { busy: boolean; error: string; onClose: () => void; onSave: (body: Record<string, unknown>) => void };
const formBody = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget)); };
function newPart(): KitPart { return { id: clientId(), type: "CPU", name: "", partNumber: "", serial: "", quantity: 1 }; }

export function BoxForm({ equipment, ...props }: Common & { equipment?: Equipment }) {
  const { tx } = usePreferences(); const labels = useLabels();
  const [parts, setParts] = useState<KitPart[]>(() => equipment?.components.length ? equipment.components : []);
  const update = (id: string, changes: Partial<KitPart>) => setParts(rows => rows.map(row => row.id === id ? { ...row, ...changes } : row));
  const defaultCategory = equipment ? (categories.includes(equipment.category) ? equipment.category : categories[1]) : categories[0];
  return <form onSubmit={event => props.onSave({ ...formBody(event), components: parts })}>
    <div className="dialog-body"><ErrorBox message={props.error} />
      <div className="form-grid">
        <Field className="kit-name-field" label={tx("設備箱名稱", "Box name")}><input name="name" defaultValue={equipment?.name} required maxLength={100} placeholder={tx("例如：Server 主機板測試箱 A", "e.g. Server mainboard box A")} /></Field>
        <Field label={tx("設備箱類別", "Box category")}><select name="category" defaultValue={defaultCategory}>{categories.map(value => <option key={value} value={value}>{labels.category(value)}</option>)}</select></Field>
        <Field label={tx("機種名稱", "Machine id")}><input name="model" defaultValue={equipment?.model || ""} maxLength={100} placeholder={tx("例如：E5-2C", "e.g. E5-2C")} /></Field>
        <Field label={tx("保管位置", "Storage location")}><input name="location" defaultValue={equipment?.location} required maxLength={100} placeholder="PED / Rack A-01" /></Field>
        <Field label={tx("設備箱狀態", "Box condition")}><select name="condition" defaultValue={equipment?.condition || "ready"}>{["ready", "maintenance", "retired"].map(value => <option key={value} value={value}>{labels.status(value)}</option>)}</select></Field>
      </div>
      <div className="section-heading"><div><h3>{tx("箱內零件清單", "Component manifest")}</h3><p>{tx("登錄名稱、規格、料號及數量；每次借用會保存當時的清單。", "Register name, specification, P/N and quantity. Each request saves its own manifest snapshot.")}</p></div><Button disabled={props.busy || parts.length >= 80} onClick={() => setParts(rows => [...rows, newPart()])}><Plus size={16} />{tx("新增零件", "Add component")}</Button></div>
      {!parts.length && <Notice>{tx("請至少新增一項零件，才能完成設備箱建檔。", "Add at least one component to register this box.")}</Notice>}
      <div className="component-editor">{parts.map((part, index) => <fieldset key={part.id} className="component-row"><legend>{tx("零件", "Component")} {index + 1}</legend>
        <Field label={tx("類別", "Type")}><select aria-label={tx("零件類別", "Component type")} value={part.type} onChange={e => update(part.id, { type: e.target.value as KitPart["type"] })}>{!(partTypes as readonly string[]).includes(part.type) && <option value={part.type} disabled>{part.type} ({tx("既有類別", "legacy")})</option>}{partTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
        <Field label={tx("名稱", "Name")}><input aria-label={tx("零件名稱", "Component name")} value={part.name} required maxLength={100} onChange={e => update(part.id, { name: e.target.value })} /></Field>
        <Field label={tx("規格", "Specification")}><input aria-label={tx("零件規格", "Component specification")} value={part.specification || ""} maxLength={100} onChange={e => update(part.id, { specification: e.target.value })} /></Field>
        <Field label={tx("料號 P/N", "Part number")}><input value={part.partNumber} maxLength={100} onChange={e => update(part.id, { partNumber: e.target.value })} /></Field>
        <Field label={tx("數量", "Quantity")}><input type="number" min={1} max={10000} required value={part.quantity} onChange={e => update(part.id, { quantity: Number(e.target.value) })} /></Field>
        <button type="button" className="icon-button danger" aria-label={tx(`移除第 ${index + 1} 項零件`, `Remove component ${index + 1}`)} onClick={() => setParts(rows => rows.filter(row => row.id !== part.id))}><Trash2 size={17} /></button>
      </fieldset>)}</div>
      <Notice>{tx("有待簽核、待借出、使用中或待歸還驗收的申請時，箱內清單會鎖定。需先結束相關申請，才能更換零件或轉為維護。", "Active requests lock the manifest. Complete or cancel them before replacing components or placing the box in maintenance.")}</Notice>
      <Field label={tx("工程備註", "Engineering notes")}><textarea name="notes" defaultValue={equipment?.notes || ""} maxLength={1000} rows={3} /></Field>
    </div><FormFooter busy={props.busy} disabled={!parts.length} label={tx("儲存設備箱", "Save box")} onClose={props.onClose} />
  </form>;
}

export function BorrowForm({ data, equipment, conflictLoanId, onExisting, ...props }: Common & { data: AppData; equipment?: Equipment; conflictLoanId?: string; onExisting: (id: string) => void }) {
  const { tx } = usePreferences(); const labels = useLabels();
  const [kitId, setKitId] = useState(equipment?.id || "");
  const [start, setStart] = useState(taipeiDate()); const [end, setEnd] = useState(taipeiDate());
  const kit = data.equipment.find(row => row.id === kitId);
  const active = data.loans.filter(row => row.equipment_id === kitId && ["pending", "approved", "borrowed", "return_pending"].includes(row.status));
  return <form onSubmit={event => { const body = formBody(event); if (kit && canRequestEquipment(kit)) props.onSave(body); }}><div className="dialog-body">
    <ErrorBox message={props.error} />{conflictLoanId && <Button disabled={props.busy} onClick={() => onExisting(conflictLoanId)}>{tx("查看原借用申請", "Open existing request")}<ArrowUpRight size={16} /></Button>}
    <Notice>{tx(`以整箱為單位借用，須由 PED 審核及點交。最長 ${data.settings.maxDays} 天。`, `Request a complete box. PED approval and itemized handover are required. Maximum ${data.settings.maxDays} days.`)}</Notice>
    <Field label={tx("選擇設備箱", "Select a box")}><select name="equipment_id" value={kitId} required onChange={event => setKitId(event.target.value)}><option value="" disabled>{tx("請選擇生產所需的設備箱", "Choose a box for production")}</option>{data.equipment.filter(row => row.condition === "ready").map(row => <option key={row.id} value={row.id} disabled={!canRequestEquipment(row)}>{row.code} · {row.name}{row.busy ? tx("（使用中）", " (issued)") : ""}</option>)}</select></Field>
    {kit && <div className="kit-context"><div className="section-heading"><div><strong>{kit.name}</strong><p>{kit.model || "—"} · {kit.location}</p></div><span className="mono">{kit.code}</span></div><PartsTable parts={kit.components} />
      {!!active.length && <div className="reserved-windows"><strong>{tx("已保留時段", "Reserved dates")}</strong>{active.map(row => <div key={row.id}><span>{labels.date(row.start)} – {labels.date(row.end)}</span><Badge status={row.status} />{row.user_id === data.user.id && <button type="button" className="text-button" onClick={() => onExisting(row.id)}>{tx("查看我的申請", "My request")}</button>}</div>)}</div>}
      {data.user.role === "employee" && <p className="help">{tx("其他產線的時段由系統於送出時檢查，不會公開同仁的申請內容。", "Other production reservations are checked on submission without exposing colleagues' request details.")}</p>}
    </div>}
    <div className="form-grid">
      <Field label={tx("借用日期", "Start date")}><input type="date" name="start" min={taipeiDate()} value={start} onChange={event => { setStart(event.target.value); if (event.target.value > end) setEnd(event.target.value); }} required /></Field>
      <Field label={tx("預計歸還日期", "Expected return")}><input type="date" name="end" min={start} value={end} onChange={event => setEnd(event.target.value)} required /></Field>
      <Field label={tx("站別", "Fixture")}><input name="production_line" required maxLength={60} placeholder="FCT-02" /></Field>
      <Field label={tx("生產機種／平台", "Product model / platform")}><input name="product_model" maxLength={100} placeholder="Server platform" /></Field>
    </div>
    <Field label={tx("生產用途說明", "Production purpose")}><textarea name="purpose" required maxLength={1000} rows={3} placeholder={tx("例如：主機板功能測試、CPU / DIMM 驗證、試產或重工測試", "e.g. Mainboard functional test, CPU / DIMM validation, pilot build or rework")} /></Field>
    <p className="borrower-line">{tx("申請人", "Requested by")}：{data.user.name} · {data.user.department}</p>
    {!!kit?.busy && <Notice>{tx("設備箱已借出，歸還後才能申請。", "This box is on loan. You can request it after it is returned.")}</Notice>}
    {kit && !kit.components.length && <Notice>{tx("此設備箱尚未有零件清單，請先聯絡 PED 完成建檔。", "Contact PED to register the component manifest before requesting this box.")}</Notice>}
  </div><FormFooter busy={props.busy} disabled={!kit || !canRequestEquipment(kit)} label={tx("送出借用申請", "Submit production request")} onClose={props.onClose} /></form>;
}

export type LoanAction = "approve" | "reject" | "checkout" | "return" | "request-return" | "reject-return" | "cancel";
export function ActionForm({ loan, action, ...props }: Omit<Common, "onSave"> & { loan: Loan; action: LoanAction; onSave: (body: Record<string, unknown>, action: LoanAction) => void }) {
  const { tx } = usePreferences();
  const [decision, setDecision] = useState<LoanAction>(action);
  const review = action === "approve" || action === "reject";
  const [checks, setChecks] = useState<PartCheck[]>(() => loan.manifest.map(part => ({ id: part.id, quantity: part.quantity, condition: "ok", checked: false })));
  const handover = action === "checkout" || action === "return";
  const selfCheck = action === "request-return";
  const inspection = handover || selfCheck;
  const selfCheckIssue = selfCheck && checks.some((row, index) => row.quantity !== loan.manifest[index].quantity || row.condition !== "ok");
  const [confirmed, setConfirmed] = useState(false);
  const pendingReturn = loan.return_requests?.find(request => request.status === "pending");
  const update = (id: string, changes: Partial<PartCheck>) => setChecks(rows => rows.map(row => row.id === id ? { ...row, ...changes } : row));
  const labels = { approve: tx("確認核准", "Approve request"), reject: tx("確認駁回", "Reject request"), checkout: tx("確認點交借出", "Confirm box issue"), return: tx("確認驗收歸還", "Accept inspected return"), "request-return": tx("送出歸還申請", "Submit return request"), "reject-return": tx("退回歸還申請", "Decline return request"), cancel: tx("確認取消申請", "Cancel request") };
  return <form onSubmit={event => props.onSave({ ...formBody(event), ...(handover ? { checklist: checks } : {}), ...(selfCheck ? { self_check: checks } : {}), confirmed, received: confirmed, return_request_id: pendingReturn?.id }, decision)}><div className="dialog-body"><ErrorBox message={props.error} />
    <div className="decision-summary"><strong className="mono">{requestId(loan)}</strong><strong>{loan.equipment_name}</strong><span>{loan.code} · {loan.user_name} · {loan.production_line || loan.department}</span>{loan.work_order && <span className="mono">{loan.work_order}</span>}</div>
    {action === "request-return" && <Notice>{tx("請先逐項自檢箱內設備的名稱、規格、料號、數量及狀況，確認齊全正常後再送出。送出後仍須由其他工程人員或管理員實際驗收。", "Check every component against its name, specification, P/N and quantity. Submit only when everything is complete and working. Another engineer or administrator must still inspect the physical return.")}</Notice>}
    {action === "reject-return" && <Notice>{tx("適用於尚未實際交回或誤送申請。退回後恢復使用中，設備箱持續占用。已收到但缺件／損壞的箱子，請使用歸還驗收並記錄異常。", "Decline requests submitted by mistake or before physical delivery. Received boxes with missing or damaged parts should be accepted through inspection and placed in maintenance.")}</Notice>}
    {action === "return" && pendingReturn && <ReturnSelfCheck parts={loan.manifest} checks={pendingReturn.self_check} />}
    {selfCheck && <h3>{tx("箱內設備自檢", "Component self-check")}</h3>}
    {inspection && <><Notice>{(action === "checkout" || selfCheck) ? tx("請核對名稱、規格、料號與數量，再逐項勾選確認。必須全數齊全正常才能送出。", "Verify the name, specification, P/N and quantity, then check each entry. All components must be complete and working before submission.") : tx("逐項記錄實際歸還數量與狀況。有缺件或損壞時，設備箱將轉為待維護／補件。", "Record actual quantities and conditions. Any missing or damaged component places the box in maintenance.")}</Notice>
      {!loan.manifest.length && <Notice>{tx("此為舊版建立的歷史申請，沒有零件快照，請於備註說明實際設備、數量與自檢／點收內容。", "This historical request has no manifest snapshot. Describe the physical components, quantities and self-check or inspection in the note.")}</Notice>}
      <div className="checklist">{loan.manifest.map((part, index) => <div className="check-row" key={part.id}>
        <label className="check-identity"><input type="checkbox" checked={checks[index].checked} onChange={e => update(part.id, { checked: e.target.checked })} /><span><strong>{part.type} · {part.name}</strong><small>{tx("規格", "Specification")}: {part.specification || "—"}</small><small className="mono">P/N {part.partNumber || "—"}{part.serial && <> · S/N {part.serial}</>}</small><small>{tx("應有數量", "Expected")}: {part.quantity}</small></span></label>
        {(action === "return" || selfCheck) ? <div className="check-controls"><Field label={selfCheck ? tx("自檢數量", "Checked qty") : tx("實還數量", "Returned qty")}><input type="number" min={0} max={part.quantity} value={checks[index].quantity} required onChange={e => update(part.id, { quantity: Number(e.target.value), ...(Number(e.target.value) < part.quantity ? { condition: "missing" as const } : {}) })} /></Field><Field label={tx("零件狀況", "Condition")}><select value={checks[index].condition} onChange={e => update(part.id, { condition: e.target.value as PartCheck["condition"] })}><option value="ok">{tx("正常", "OK")}</option><option value="missing">{tx("缺件", "Missing")}</option><option value="damaged">{tx("損壞", "Damaged")}</option></select></Field></div> : <span className="mono">× {part.quantity}</span>}
      </div>)}</div>
    </>}
    {selfCheckIssue && <Notice>{tx("自檢發現缺件、數量不符或損壞，暫時無法送出。請先聯絡工程人員或管理員協助確認。", "Missing, damaged or mismatched components prevent submission. Contact an engineer or administrator for assistance.")}</Notice>}
    {review && <div className="field"><span>{tx("簽核結果", "Review decision")}</span><div className="review-decision" role="group" aria-label={tx("簽核結果", "Review decision")}><Button disabled={props.busy} aria-pressed={decision === "approve"} className="review-approve" onClick={() => setDecision("approve")}>{tx("核准", "Approve")}</Button><Button disabled={props.busy} aria-pressed={decision === "reject"} className="review-reject" onClick={() => setDecision("reject")}>{tx("駁回", "Reject")}</Button></div></div>}
    {!handover && <div className="detail-purpose"><small>{tx("生產用途", "Production purpose")}</small><p>{loan.purpose}</p></div>}
    <Field label={action === "return" ? tx("歸還檢查紀錄（必填）", "Return inspection note (required)") : decision === "reject" || action === "reject-return" ? tx("退回／駁回原因（必填）", "Decline / rejection reason (required)") : action === "request-return" ? (loan.manifest.length ? tx("歸還說明（選填）", "Return note (optional)") : tx("實際設備自檢說明（必填）", "Physical self-check note (required)")) : tx("工程處理備註", "Engineering note")}><textarea name="note" required={action === "return" || decision === "reject" || action === "reject-return" || (selfCheck && !loan.manifest.length)} rows={3} maxLength={1000} /></Field>
    {(action === "request-return" || action === "return") && <label className="batch-confirm"><input type="checkbox" checked={confirmed} disabled={props.busy} onChange={event => setConfirmed(event.target.checked)} /><span>{action === "request-return" ? tx("已逐項自檢設備齊全正常、確認箱號與站別，並了解仍需工程人員驗收", "I checked that all components are complete and working, confirmed the box and fixture, and understand that engineering inspection is still required") : tx("已實際收到設備箱，並完成本次零件點收", "I physically received the box and completed the component inspection")}</span></label>}
    {inspection && !!loan.manifest.length && <p className="help">{tx(`已確認 ${checks.filter(row => row.checked).length} / ${checks.length} 項零件`, `${checks.filter(row => row.checked).length} / ${checks.length} components checked`)}</p>}
  </div><FormFooter busy={props.busy} disabled={(inspection && checks.some(row => !row.checked)) || selfCheckIssue || ((action === "request-return" || action === "return") && !confirmed)} label={labels[decision]} onClose={props.onClose} /></form>;
}

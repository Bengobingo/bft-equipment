"use client";
import { clientId } from "@/lib/client-id";
import { useRef, useState } from "react";
import { usePreferences } from "./preferences";
import { Button, ErrorBox, Field, Modal, PartsTable, requestId, useLabels } from "./ped-ui";
import { request } from "@/lib/client";
import { taipeiDate, type Equipment, type Loan } from "@/lib/types";

type Outcome = { loanId: string; status: "success" | "failed"; error?: string };
type BatchResult = { batchId: string; results: Outcome[]; succeeded: number; failed: number };
type Payload = { batchId: string; note: string; items: { loanId: string; expectedUpdated: string; confirmed: boolean }[] };
export function BatchCheckout({ loans, equipment, onRefresh }: { loans: Loan[]; equipment: Equipment[]; onRefresh: () => Promise<unknown> }) {
  const { tx } = usePreferences();
  const [opened, setOpened] = useState(false);
  return <><div className="batch-toolbar"><Button disabled={!loans.length} onClick={() => setOpened(true)}>{tx("批量點交領出", "Batch issue boxes")}</Button><span>{tx("同一借用人可跨站別領出，每批最多 50 箱。", "Same borrower across fixtures; up to 50 boxes per batch.")}</span></div>{opened && <BatchDialog loans={loans} equipment={equipment} onRefresh={onRefresh} onClose={() => setOpened(false)} />}</>;
}
function BatchDialog({ loans, equipment, onRefresh, onClose }: { loans: Loan[]; equipment: Equipment[]; onRefresh: () => Promise<unknown>; onClose: () => void }) {
  const { tx, locale } = usePreferences(); const labels = useLabels();
  const [snapshot] = useState(loans);
  const groupKey = (loan: Loan) => loan.user_id;
  const groups = [...new Map(snapshot.map(loan => [groupKey(loan), loan])).entries()];
  const [group, setGroup] = useState(groups[0]?.[0] || "");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [stage, setStage] = useState<"select" | "check" | "result">("select");
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [result, setResult] = useState<BatchResult>();
  const [payload, setPayload] = useState<Payload>(); const submitting = useRef(false);
  const today = taipeiDate();
  const problem = (loan: Loan) => {
    const box = equipment.find(row => row.id === loan.equipment_id);
    return loan.status !== "approved" ? tx("尚未核准", "Not approved") : loan.start > today || loan.end < today ? tx("不在借用期間", "Outside borrowing period") : !box || box.condition !== "ready" || !!box.busy ? tx("設備箱不可領用", "Box unavailable") : !loan.manifest.length ? tx("沒有零件快照，請單箱點交", "No manifest; use single-box issue") : "";
  };
  const rows = snapshot.filter(loan => groupKey(loan) === group);
  const chosen = snapshot.filter(loan => selected.includes(loan.id));
  const quantity = chosen.reduce((total, loan) => total + loan.manifest.reduce((sum, part) => sum + part.quantity, 0), 0);
  function toggle(id: string) { setSelected(items => items.includes(id) ? items.filter(value => value !== id) : items.length < 50 ? [...items, id] : items); }
  async function submit() {
    if (submitting.current) return;
    if (!payload && (!chosen.length || chosen.some(loan => !confirmed.includes(loan.id)))) return;
    const body = payload || { batchId: clientId(), note, items: chosen.map(loan => ({ loanId: loan.id, expectedUpdated: loan.updated, confirmed: true })) };
    setPayload(body); submitting.current = true; setBusy(true); setError("");
    try {
      const response = await request<BatchResult>("loans/batch-checkout", locale, "POST", body);
      setResult(response); setStage("result");
      try { await onRefresh(); } catch { setError(tx("領出結果已儲存，請重新整理清單。", "Results were saved. Refresh the list.")); }
    } catch (cause) { setError((cause as Error).message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Modal title={tx("批量點交領出", "Batch issue boxes")} onClose={onClose} busy={busy} wide>
    <div className="dialog-body batch-dialog"><ErrorBox message={error} />
      {stage === "select" ? <>
        <Field label={tx("借用人", "Borrower")}><select value={group} onChange={event => { setGroup(event.target.value); setSelected([]); setConfirmed([]); }}>{groups.map(([key, loan]) => <option key={key} value={key}>{loan.user_name} · {loan.department}</option>)}</select></Field>
        <div className="batch-selection-tools"><Button onClick={() => setSelected(rows.filter(loan => !problem(loan)).slice(0, 50).map(loan => loan.id))}>{tx("全選可領出（最多 50 箱）", "Select eligible boxes (max 50)")}</Button><Button onClick={() => setSelected([])}>{tx("清除選取", "Clear selection")}</Button><span>{tx(`已選 ${chosen.length} 箱`, `${chosen.length} boxes selected`)}</span></div>
        <div className="table-scroll"><table><thead><tr><th>{tx("申請編號", "Request")}</th><th>{tx("設備箱", "Box")}</th><th>{tx("站別", "Fixture")}</th><th>{tx("借用期間", "Dates")}</th><th>{tx("狀態", "Status")}</th></tr></thead><tbody>{rows.map(loan => <tr key={loan.id}><td><label className="batch-select"><input type="checkbox" checked={selected.includes(loan.id)} disabled={!!problem(loan) || (selected.length >= 50 && !selected.includes(loan.id))} onChange={() => toggle(loan.id)} /><span className="mono">{requestId(loan)}</span></label></td><td><strong>{loan.code} · {loan.equipment_name}</strong><small>{loan.manifest.length} {tx("項零件", "component entries")}</small></td><td>{loan.production_line || "—"}</td><td>{labels.date(loan.start)} – {labels.date(loan.end)}</td><td>{problem(loan) || labels.status("approved")}</td></tr>)}</tbody></table></div>
      </> : stage === "check" ? <>
        <div className="notice"><span>{tx(`共 ${chosen.length} 箱、${quantity} 件零件。請實際核對每箱全部零件後，分別勾選確認。`, `${chosen.length} boxes, ${quantity} components. Physically inspect every box before confirming it.`)}</span></div>
        {chosen.map(loan => <section className="batch-box" key={loan.id}><div className="batch-box-heading"><div><strong>{loan.code} · {loan.equipment_name}</strong><p>{requestId(loan)} · {loan.user_name} · {loan.production_line}</p></div>{!payload && <Button onClick={() => { setSelected(items => items.filter(id => id !== loan.id)); setConfirmed(items => items.filter(id => id !== loan.id)); }}>{tx("移除此箱", "Remove box")}</Button>}</div><details><summary>{tx("展開零件清單", "Show component manifest")} ({loan.manifest.length})</summary><PartsTable parts={loan.manifest} /></details><label className="batch-confirm"><input type="checkbox" disabled={busy || !!payload} checked={confirmed.includes(loan.id)} onChange={event => setConfirmed(items => event.target.checked ? [...items, loan.id] : items.filter(id => id !== loan.id))} /><span>{tx("已核對此箱全部零件、料號與數量，齊全且正常", "All components, P/Ns and quantities in this box have been checked and are complete and working")}</span></label></section>)}
        <Field label={tx("共同點交備註（選填）", "Shared handover note (optional)")}><textarea value={note} disabled={busy || !!payload} onChange={event => setNote(event.target.value)} maxLength={1000} rows={3} /></Field>
      </> : result && <><p role="status">{tx(`成功 ${result.succeeded} 箱，失敗 ${result.failed} 箱。`, `${result.succeeded} succeeded, ${result.failed} failed.`)}</p><p className="help mono">{result.batchId}</p>{result.results.map(row => { const loan = snapshot.find(item => item.id === row.loanId); return <div className={`batch-result ${row.status}`} key={row.loanId}><div><strong>{loan?.code} · {loan?.equipment_name}</strong><p>{tx("站別", "Fixture")}: {loan?.production_line || "—"}</p></div><span>{row.status === "success" ? tx("領出成功", "Issued successfully") : row.error}</span></div>; })}<p className="help">{tx("重試會略過已成功領出的箱子。若申請內容已變更，請關閉並重新選取。", "Retry skips successful boxes. If request details changed, close and select again.")}</p></>}
    </div>
    <footer className="dialog-footer"><Button disabled={busy} onClick={onClose}>{tx("關閉", "Close")}</Button>{stage === "select" && <Button variant="primary" disabled={!chosen.length} onClick={() => setStage("check")}>{tx(`清點 ${chosen.length} 箱`, `Inspect ${chosen.length} boxes`)}</Button>}{stage === "check" && <>{!payload && <Button disabled={busy} onClick={() => setStage("select")}>{tx("返回選取", "Back to selection")}</Button>}<Button variant="primary" disabled={busy || !chosen.length || chosen.some(loan => !confirmed.includes(loan.id))} onClick={submit}>{busy ? tx("處理中…", "Processing…") : payload ? tx("重試領出", "Retry issue") : tx(`確認領出 ${chosen.length} 箱`, `Confirm issue of ${chosen.length} boxes`)}</Button></>}{stage === "result" && !!result?.failed && <Button variant="primary" disabled={busy} onClick={submit}>{busy ? tx("處理中…", "Processing…") : tx("重試失敗項目", "Retry failed items")}</Button>}</footer>
  </Modal>;
}

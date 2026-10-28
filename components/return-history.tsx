"use client";
import { usePreferences } from "./preferences";
import { useLabels } from "./ped-ui";
import { PartsTable } from "./ped-ui";
import type { ReturnRequest, KitPart, PartCheck } from "@/lib/types";

export function ReturnHistory({ requests, parts }: { requests: ReturnRequest[]; parts: KitPart[] }) {
  const { tx } = usePreferences(); const labels = useLabels();
  if (!requests.length) return null;
  return <section><h3>{tx("歸還申請與驗收紀錄", "Return requests and inspections")}</h3><ol className="return-request-history">{requests.map(request => <li key={request.id}>
    <strong>{request.status === "pending" ? tx("待歸還驗收", "Awaiting return inspection") : request.status === "accepted" ? tx("已驗收歸還", "Return accepted") : tx("已退回歸還申請", "Return request declined")}</strong>
    <p>{tx("申請人", "Requested by")}: {request.requester_name} · {labels.date(request.requested, true)}</p>
    <ReturnSelfCheck parts={parts} checks={request.self_check} />
    {request.request_note && <p>{tx("歸還說明", "Return note")}: {request.request_note}</p>}
    {request.reviewed && <><p>{tx("驗收／處理人員", "Inspector / reviewer")}: {request.reviewer_name || "—"} · {labels.date(request.reviewed, true)}</p><p>{request.review_note}</p></>}
  </li>)}</ol></section>;
}

export function ReturnSelfCheck({ parts, checks }: { parts: KitPart[]; checks: PartCheck[] | null | undefined }) {
  const { tx } = usePreferences();
  return <div className="return-self-check"><h4>{tx("借用人設備自檢", "Borrower component self-check")}</h4>
    {checks == null ? <p className="help">{tx("此申請建立於自檢功能加入前，未留存自檢紀錄，請依實物驗收。", "This request predates self-check records. Inspect the physical contents.")}</p> : checks.length ? <PartsTable parts={parts} checks={checks} /> : <p className="help">{tx("歷史借用沒有零件快照，自檢內容請見申請人的說明。", "This historical loan has no manifest snapshot. See the requester's self-check note.")}</p>}
  </div>;
}

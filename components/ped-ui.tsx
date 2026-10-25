"use client";
import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { AlertCircle, Box, X, PackageOpen, LoaderCircle } from "lucide-react";
import { AppearanceControls, usePreferences } from "./preferences";
import { categories, type KitPart, type PartCheck, type Loan, type Role } from "@/lib/types";

export function Button({ children, variant = "", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return <button type="button" {...props} className={`button ${variant} ${className}`}>{children}</button>;
}
export function Brand({ onHome }: { onHome?: () => void }) {
  const { tx } = usePreferences();
  const content = <><Box size={30} strokeWidth={1.6} aria-hidden="true" /><span><strong>BFT <b>PED</b></strong><small>{tx("工程設備箱管制", "Engineering Kit Control")}</small></span></>;
  return onHome ? <a className="brand" href="#dashboard" aria-label={tx("BFT PED 首頁", "BFT PED home")} title={tx("返回總覽", "Back to dashboard")} onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onHome(); } }}>{content}</a> : <div className="brand">{content}</div>;
}
export function Avatar({ name }: { name: string }) {
  const clean = name.trim();
  const initials = /^[\x20-\x7E]+$/.test(clean) ? (clean.length <= 4 ? clean : clean.split(/\s+/).length > 1 ? clean.split(/\s+/).slice(0, 2).map(s => s[0]).join("") : clean.slice(0, 2)) : Array.from(clean).slice(-2).join("");
  return <span className="avatar" title={name}>{initials || "?"}</span>;
}
export function useLabels() {
  const { locale, tx } = usePreferences();
  const status = (value: string) => ({
    pending: tx("待 PED 簽核", "Pending PED review"), approved: tx("待點交借出", "Ready to issue"), borrowed: tx("產線使用中", "On production line"),
    returned: tx("已歸還", "Returned"), rejected: tx("已駁回", "Rejected"), cancelled: tx("已取消", "Cancelled"),
    ready: tx("可申請", "Available"), unconfigured: tx("待建零件清單", "Manifest needed"), reserved: tx("今日已預約", "Reserved today"), maintenance: tx("待維護／補件", "Maintenance / shortage"), retired: tx("已停用", "Retired"), overdue: tx("逾期未還", "Overdue"),
  }[value] || value);
  const role = (value: Role) => ({ employee: tx("產線操作人員", "Production operator"), approver: tx("PED 工程人員", "PED engineer"), custodian: tx("PED 設備箱管理員", "PED kit custodian"), admin: tx("PED 系統管理員", "PED administrator") }[value]);
  const category = (value: string) => locale !== "en" ? value : ["Server system kit", "Mainboard test kit", "CPU / DIMM kit", "Storage / cable kit", "Thermal / fixture kit", "Other engineering kit"][categories.indexOf(value)] || value;
  const date = (value: string, time = false) => value ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", ...(time ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) }).format(new Date(value.length === 10 ? value + "T00:00:00+08:00" : value)) : "—";
  return { status, role, category, date };
}
export function Badge({ status }: { status: string }) {
  const labels = useLabels();
  return <span className={`badge status-${status}`}><i />{labels.status(status)}</span>;
}
export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function ErrorBox({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) ref.current?.focus(); }, [message]);
  return message ? <div className="form-error" role="alert" ref={ref} tabIndex={-1}><AlertCircle size={18} /><span>{message}</span></div> : null;
}
export function Notice({ children }: { children: ReactNode }) { return <div className="notice"><AlertCircle size={17} /><div>{children}</div></div>; }
export function Empty({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="empty"><PackageOpen size={30} strokeWidth={1.2} /><h3>{title}</h3>{detail && <p>{detail}</p>}{action}</div>;
}
export function Modal({ title, children, onClose, busy = false, wide = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { tx } = usePreferences();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; before?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? "wide" : ""}`} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id="dialog-title">{title}</h2><div className="dialog-tools"><AppearanceControls /><button type="button" disabled={busy} className="icon-button" aria-label={tx("關閉視窗", "Close dialog")} onClick={onClose}><X size={21} /></button></div></header>{children}
  </dialog>;
}
export function FormFooter({ busy, disabled = false, label, onClose }: { busy: boolean; disabled?: boolean; label: string; onClose: () => void }) {
  const { tx } = usePreferences();
  return <footer className="dialog-footer"><Button disabled={busy} onClick={onClose}>{tx("取消", "Cancel")}</Button><Button type="submit" variant="primary" disabled={busy || disabled}>{busy && <LoaderCircle className="spinner" size={16} />}{label}</Button></footer>;
}
export function PartsTable({ parts, checks }: { parts: KitPart[]; checks?: PartCheck[] }) {
  const { tx } = usePreferences();
  if (!parts.length) return <p className="muted manifest-empty">{tx("尚未建立零件清單；歷史申請保留原紀錄。", "No manifest registered. Historical requests retain their original records.")}</p>;
  return <div className="table-scroll"><table className="parts-table"><thead><tr><th>{tx("類別", "Type")}</th><th>{tx("零件／規格", "Component / specification")}</th><th>{tx("料號 / 序號", "P/N / S/N")}</th><th className="number">{tx("數量", "Qty")}</th>{checks?.length ? <th>{tx("點交紀錄", "Inspection")}</th> : null}</tr></thead><tbody>{parts.map(part => {
    const check = checks?.find(row => row.id === part.id);
    return <tr key={part.id}><td><span className="part-type">{part.type === "Other" ? tx("其他", "Other") : part.type}</span></td><td>{part.name}</td><td className="mono identifiers">{part.partNumber || "—"}<small>{part.serial || "—"}</small></td><td className="number">{part.quantity}</td>{checks?.length ? <td>{check ? `${check.quantity} / ${part.quantity} · ${check.condition === "ok" ? tx("正常", "OK") : check.condition === "missing" ? tx("缺件", "Missing") : tx("損壞", "Damaged")}` : "—"}</td> : null}</tr>;
  })}</tbody></table></div>;
}
export const requestId = (loan: Pick<Loan, "id">) => "BR-" + loan.id.replaceAll("-", "").slice(0, 7).toUpperCase();

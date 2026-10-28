export const roles = {
  employee: "產線操作人員",
  approver: "PED 工程人員",
  admin: "系統管理員",
} as const;
export type Role = keyof typeof roles;
export type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  department: string;
  role: Role;
  active: number;
  must_change: number;
  created: string;
};
export type Equipment = {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serial: string;
  location: string;
  condition: "ready" | "maintenance" | "retired";
  notes: string;
  created: string;
  busy?: number;
  reserved?: number;
  awaiting_issue?: number;
  awaiting_return?: number;
  components: KitPart[];
};
export const partTypes = ["CPU", "Memory", "Motherboard", "Storage", "PCIe/Expansion", "Network", "Power", "Cable", "Heatsink", "Other"] as const;
export const legacyPartTypes = ["DIMM", "U.2"] as const;
export type KitPart = {
  id: string;
  type: (typeof partTypes)[number] | (typeof legacyPartTypes)[number];
  name: string;
  specification?: string;
  partNumber: string;
  serial: string;
  quantity: number;
};
export type PartCheck = {
  id: string;
  quantity: number;
  condition: "ok" | "damaged" | "missing";
  checked: boolean;
};
export type ReturnRequest = {
  id: string; loan_id: string; requester_id: string; requested: string; request_note: string;
  status: "pending" | "accepted" | "rejected";
  reviewer_id: string | null; reviewed: string | null; review_note: string;
  requester_name: string; reviewer_name: string | null;
  self_check: PartCheck[] | null;
};
export type Loan = {
  id: string;
  equipment_id: string;
  user_id: string;
  department: string;
  start: string;
  end: string;
  purpose: string;
  status:
    "pending" | "approved" | "borrowed" | "return_pending" | "returned" | "rejected" | "cancelled";
  created: string;
  updated: string;
  approver_id: string | null;
  decision_note: string;
  checked_out: string | null;
  returned: string | null;
  return_note: string;
  equipment_name: string;
  code: string;
  category: string;
  user_name: string;
  approver_name: string | null;
  production_line: string;
  work_order: string;
  product_model: string;
  manifest: KitPart[];
  checkout_batch_id?: string | null;
  checkout_check: PartCheck[];
  return_check: PartCheck[];
  return_requests?: ReturnRequest[];
};
export type Event = {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target: string;
  detail: string;
  created: string;
};
export type AppData = {
  user: User;
  equipment: Equipment[];
  loans: Loan[];
  users: User[];
  events: Event[];
  settings: { organization: string; maxDays: number };
  sample: boolean;
};
export const statusNames: Record<Loan["status"], string> = {
  pending: "待簽核",
  approved: "待領用",
  borrowed: "借用中",
  return_pending: "待歸還驗收",
  returned: "已歸還",
  rejected: "已駁回",
  cancelled: "已取消",
};
export function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
const requestNumberDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei", year: "2-digit", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function requestId(loan: Pick<Loan, "created">) {
  const parts = requestNumberDate.formatToParts(new Date(loan.created));
  return "BR" + ["year", "month", "day", "hour", "minute"].map(key => parts.find(part => part.type === key)!.value).join("");
}
export function overdue(l: Loan) {
  return ["borrowed", "return_pending"].includes(l.status) && l.end < taipeiDate();
}
export function canApprove(u: User, l: Loan) {
  return (
    l.status === "pending" &&
    l.user_id !== u.id &&
    canReviewLoans(u)
  );
}
export function canReviewLoans(u: Pick<User, "role">) {
  return u.role === "admin" || u.role === "approver";
}
export function notificationLoans(user: User, loans: Loan[]): Loan[] {
  return canManageEquipment(user)
    ? loans.filter(loan => loan.status === "approved" || canApprove(user, loan) || canReturnLoan(user, loan))
    : loans.filter(loan => ["borrowed", "return_pending"].includes(loan.status) && loan.user_id === user.id);
}
export function canRequestReturn(u: Pick<User, "id">, loan: Pick<Loan, "user_id" | "status">) {
  return loan.status === "borrowed" && u.id === loan.user_id;
}
export function canReturnLoan(u: Pick<User, "id" | "role">, loan: Pick<Loan, "user_id" | "status">) {
  return loan.status === "return_pending" && canManageEquipment(u) && u.id !== loan.user_id;
}
export function equipmentStatus(kit: Pick<Equipment, "condition" | "components" | "busy" | "reserved" | "awaiting_issue" | "awaiting_return">) {
  return kit.condition !== "ready" ? kit.condition : kit.awaiting_return ? "return_pending" : kit.busy ? "borrowed" : !kit.components.length ? "unconfigured" : kit.awaiting_issue ? "approved" : kit.reserved ? "reserved" : "ready";
}
export function canRequestEquipment(equipment: Pick<Equipment, "condition" | "components" | "busy">) {
  return equipment.condition === "ready" && equipment.components.length > 0 && !equipment.busy;
}
export function canManageEquipment(u: Pick<User, "role">) {
  return ["admin", "approver"].includes(u.role);
}
export const categories = ["主機板測試設備箱", "其他工程設備箱"];

export const roles = {
  employee: "一般使用者",
  approver: "簽核主管",
  custodian: "設備管理員",
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
    "pending" | "approved" | "borrowed" | "returned" | "rejected" | "cancelled";
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
export function overdue(l: Loan) {
  return l.status === "borrowed" && l.end < taipeiDate();
}
export function canApprove(u: User, l: Loan) {
  return (
    l.status === "pending" &&
    l.user_id !== u.id &&
    (u.role === "admin" ||
      (u.role === "approver" && u.department === l.department))
  );
}
export const categories = [
  "電腦設備",
  "攝影器材",
  "影音設備",
  "行動裝置",
  "辦公設備",
  "其他設備",
];

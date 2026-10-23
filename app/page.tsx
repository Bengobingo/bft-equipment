"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Box,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UsersRound,
  X,
  AlertCircle,
  Camera,
  Mic,
  Tablet,
  Printer,
  LockKeyhole,
  CheckCircle2,
} from "lucide-react";
import {
  roles,
  statusNames,
  categories,
  taipeiDate,
  overdue,
  canApprove,
  type AppData,
  type User,
  type Equipment,
  type Loan,
} from "@/lib/types";

type Page =
  | "dashboard"
  | "equipment"
  | "loans"
  | "approvals"
  | "reports"
  | "users"
  | "audit"
  | "settings";
type Modal =
  | { type: "borrow"; equipment?: Equipment }
  | { type: "equipment"; equipment?: Equipment }
  | { type: "loan"; loan: Loan }
  | { type: "decision"; loan: Loan; action: string }
  | { type: "user"; user?: User }
  | { type: "help" }
  | null;
const nav = [
  { id: "dashboard", label: "總覽儀錶板", icon: LayoutDashboard },
  { id: "equipment", label: "設備資產", icon: Package },
  { id: "loans", label: "借還管理", icon: ArrowDownLeft },
  { id: "approvals", label: "簽核中心", icon: ClipboardCheck },
  { id: "reports", label: "統計報表", icon: TrendingUp },
  { id: "users", label: "成員與權限", icon: UsersRound },
  { id: "audit", label: "操作紀錄", icon: History },
  { id: "settings", label: "帳號與設定", icon: Settings },
] as const;
const dateLabel = (s: string, full = false) =>
  s
    ? new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        ...(full ? { year: "numeric" as const } : {}),
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(s.length === 10 ? s + "T00:00:00+08:00" : s))
    : "—";
const timeLabel = (s: string) =>
  new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(s));
const shortId = (id: string) =>
  "BR-" + id.replaceAll("-", "").slice(0, 7).toUpperCase();
function categoryIcon(c: string) {
  return c === "攝影器材"
    ? Camera
    : c === "影音設備"
      ? Mic
      : c === "行動裝置"
        ? Tablet
        : c === "辦公設備"
          ? Printer
          : Monitor;
}
function Button({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={"button " + className} {...props}>
      {children}
    </button>
  );
}
function Badge({ status, late = false }: { status: string; late?: boolean }) {
  return (
    <span className={"badge " + (late ? "overdue" : status)}>
      <span className="status-dot" />
      {late
        ? "已逾期"
        : statusNames[status as keyof typeof statusNames] ||
          (
            {
              ready: "可供借用",
              maintenance: "維護中",
              retired: "已停用",
              busy: "借用中",
            } as Record<string, string>
          )[status] ||
          status}
    </span>
  );
}
function Empty({
  title = "目前沒有資料",
  description = "建立第一筆資料，開始管理你的設備。",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Box size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const displayName = name.trim();
  const characters = Array.from(displayName);
  const isLatinName = /\p{Script=Latin}/u.test(displayName);
  const label = isLatinName
    ? characters.length <= 4
      ? displayName
      : displayName
          .split(/\s+/u)
          .slice(0, 2)
          .map((part) => Array.from(part)[0])
          .join("")
          .toLocaleUpperCase()
    : characters.slice(-2).join("");
  return (
    <span
      className={"avatar " + (small ? "small " : "") + (Array.from(label).length > 2 ? "name-label" : "")}
      title={displayName}
      aria-hidden="true"
      style={
        {
          "--avatar-hue": String(
            ([...name].reduce((s, c) => s + c.charCodeAt(0), 0) * 67) % 360,
          ),
        } as React.CSSProperties
      }
    >
      {label}
    </span>
  );
}
function Brand() {
  return (
    <div className="brand">
      <svg
        width="31"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M16 2 29 9.5v13L16 30 3 22.5v-13L16 2Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m3.5 10 12.5 7 12.5-7M16 17v13M9.5 6l13 7.5v8"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <strong>
        BFT<span>設備管理</span>
      </strong>
    </div>
  );
}
function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={onClose}
      aria-labelledby="modal-title"
    >
      <div className="dialog-header">
        <h2 id="modal-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="關閉視窗"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let d: any;
  try {
    d = await r.json();
  } catch {
    throw new Error("伺服器回應異常，請稍後重試");
  }
  if (!r.ok) throw new Error(d.error || "操作失敗");
  return d;
}
function exportCsv(name: string, headers: string[], rows: unknown[][]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const url = URL.createObjectURL(
    new Blob(
      [
        "\uFEFF" +
          [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-input">
      <Search size={16} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button aria-label="清除搜尋" onClick={() => onChange("")}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  unit,
  note,
  accent = false,
  onClick,
}: {
  label: string;
  value: number;
  unit: string;
  note: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="metric-label">
        {label}
        {onClick && <ArrowUpRight size={14} />}
      </span>
      <span className={"metric-value " + (accent ? "accent" : "")}>
        {value.toLocaleString()}
        <small>{unit}</small>
      </span>
      <span className="metric-note">{note}</span>
    </>
  );
  return onClick ? (
    <button className="metric" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="metric">{body}</div>
  );
}
function Pagination({
  limit,
  total,
  setLimit,
}: {
  limit: number;
  total: number;
  setLimit: (n: number) => void;
}) {
  return total > 0 ? (
    <div className="pagination">
      <span>
        顯示 {Math.min(limit, total)} / {total} 筆
      </span>
      {limit < total && (
        <Button onClick={() => setLimit(limit + 10)}>
          載入更多 <ChevronDown size={15} />
        </Button>
      )}
    </div>
  ) : null;
}
function TimelineStep({
  title,
  detail,
  done,
}: {
  title: string;
  detail: string;
  done: boolean;
}) {
  return (
    <div className={"timeline-step " + (done ? "done" : "")}>
      <span>{done ? <Check size={13} /> : <span />}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [auth, setAuth] = useState<{
      setup: boolean;
      user: User | null;
    } | null>(null),
    [data, setData] = useState<AppData | null>(null),
    [error, setError] = useState("");
  const [page, setPage] = useState<Page>("dashboard"),
    [modal, setModal] = useState<Modal>(null),
    [navOpen, setNavOpen] = useState(false),
    [notifications, setNotifications] = useState(false),
    [globalSearch, setGlobalSearch] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("all"),
    [grid, setGrid] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [formError, setFormError] = useState(""),
    [period, setPeriod] = useState(30),
    [settingsTab, setSettingsTab] = useState("profile"),
    [limit, setLimit] = useState(10);
  const errorRef = useRef<HTMLDivElement>(null),
    nextSearch = useRef("");
  async function load() {
    const a = await api("auth");
    setAuth(a);
    setData(a.user ? await api("state") : null);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const route = () => {
      const p = location.hash.slice(1);
      if (nav.some((n) => n.id === p)) setPage(p as Page);
    };
    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    setSearch(nextSearch.current);
    nextSearch.current = "";
    setFilter("all");
    setCategory("all");
    setLimit(10);
    setNavOpen(false);
    setNotifications(false);
  }, [page]);
  useEffect(() => {
    setFormError("");
  }, [modal]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (e.key === "Escape") {
        setNotifications(false);
        setNavOpen(false);
        setGlobalSearch("");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  function navigate(p: Page) {
    setPage(p);
    location.hash = p;
    setGlobalSearch("");
  }
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    message: string,
    close = true,
  ) {
    setBusy(true);
    setFormError("");
    try {
      await api(path, method, body);
      await load();
      if (close) setModal(null);
      setToast(message);
      return true;
    } catch (e) {
      setFormError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function submit(
    e: FormEvent<HTMLFormElement>,
    fn: (b: Record<string, FormDataEntryValue>) => void,
  ) {
    e.preventDefault();
    fn(Object.fromEntries(new FormData(e.currentTarget)));
  }
  if (error && !auth)
    return (
      <div className="startup-error">
        <AlertCircle />
        <h1>無法連線到系統</h1>
        <p>{error}</p>
        <Button
          onClick={() => {
            setError("");
            load().catch((e) => setError(e.message));
          }}
        >
          重新連線
        </Button>
      </div>
    );
  if (!auth)
    return (
      <div className="loading-screen">
        <Brand />
        <span className="spinner" />
        <p>正在準備你的設備工作空間</p>
      </div>
    );
  if (!auth.user) return <AuthScreen setup={auth.setup} onDone={load} />;
  if (!data)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <p>正在載入設備與借還紀錄</p>
        {error && <p role="alert">{error}</p>}
        <Button onClick={() => load().catch((e) => setError(e.message))}>
          重新載入
        </Button>
      </div>
    );
  const u = data.user,
    manage = ["admin", "custodian"].includes(u.role),
    approver = ["admin", "approver"].includes(u.role),
    isAdmin = u.role === "admin";
  const accessible = nav.filter(
      (n) =>
        (n.id !== "users" || isAdmin) && (n.id !== "approvals" || approver),
    ),
    current = accessible.some((n) => n.id === page) ? page : "dashboard";
  const pending = data.loans.filter((l) => canApprove(u, l)),
    borrowed = data.loans.filter((l) => l.status === "borrowed"),
    late = borrowed.filter(overdue),
    today = taipeiDate(),
    due = borrowed.filter(
      (l) =>
        l.end >= today &&
        l.end <= taipeiDate(new Date(Date.now() + 2 * 86400000)),
    ),
    available = data.equipment.filter(
      (e) => e.condition === "ready" && !e.busy,
    ),
    maintenance = data.equipment.filter((e) => e.condition === "maintenance");
  const notices = [
    ...late.map((l) => ({
      title: l.equipment_name,
      description: `${l.user_name}・應於 ${dateLabel(l.end)} 歸還`,
      loan: l,
      type: "逾期歸還",
    })),
    ...pending.map((l) => ({
      title: l.equipment_name,
      description: `${l.user_name}・${l.department}`,
      loan: l,
      type: "等待你的簽核",
    })),
    ...due.map((l) => ({
      title: l.equipment_name,
      description: `${l.user_name}・${dateLabel(l.end)} 到期`,
      loan: l,
      type: "即將到期",
    })),
  ];
  const match = (s: string) => s.toLowerCase().includes(search.toLowerCase());
  const eqRows = data.equipment.filter(
    (e) =>
      match(`${e.name} ${e.code} ${e.brand} ${e.model} ${e.location}`) &&
      (category === "all" || e.category === category) &&
      (filter === "all" ||
        (filter === "ready" && e.condition === "ready" && !e.busy) ||
        (filter === "busy" && e.busy) ||
        (e.condition === filter && filter !== "ready")),
  );
  const loanRows = data.loans.filter(
    (l) =>
      match(
        `${l.equipment_name} ${l.code} ${l.user_name} ${l.purpose} ${shortId(l.id)}`,
      ) &&
      (filter === "all" ||
        (filter === "mine" && l.user_id === u.id) ||
        (filter === "overdue" && overdue(l)) ||
        l.status === filter),
  );
  const approvalRows = data.loans.filter(
    (l) =>
      l.user_id !== u.id &&
      (isAdmin || l.department === u.department) &&
      match(`${l.equipment_name} ${l.user_name} ${l.department}`) &&
      (filter === "all"
        ? l.status === "pending"
        : filter === "done"
          ? !!l.approver_id
          : l.approver_id === u.id),
  );
  const userRows = data.users.filter(
    (x) =>
      match(x.name + " " + x.username + " " + x.department) &&
      (filter === "all" || x.role === filter) &&
      (category === "all" || Boolean(x.active) === (category === "active")),
  );
  const auditRows = data.events.filter((e) =>
    match(e.actor_name + " " + e.action + " " + e.detail),
  );
  const formAlert = formError ? (
    <div className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
      <AlertCircle size={17} />
      {formError}
    </div>
  ) : null;
  const exportLoans = (rows: Loan[]) =>
    exportCsv(
      `BFT-借還紀錄-${today}`,
      [
        "申請編號",
        "設備編號",
        "設備名稱",
        "申請人",
        "部門",
        "借用日期",
        "歸還期限",
        "狀態",
        "借用用途",
        "簽核人",
        "簽核意見",
        "實際歸還",
        "歸還檢查",
      ],
      rows.map((l) => [
        shortId(l.id),
        l.code,
        l.equipment_name,
        l.user_name,
        l.department,
        l.start,
        l.end,
        overdue(l) ? "已逾期" : statusNames[l.status],
        l.purpose,
        l.approver_name,
        l.decision_note,
        l.returned,
        l.return_note,
      ]),
    );
  function loanTable(rows: Loan[], overview = false) {
    return rows.length ? (
      <div className="table-scroll">
        <table className="loan-table">
          <thead>
            <tr>
              <th>設備 / 申請編號</th>
              <th>借用人</th>
              <th className="date-cell">借用期間</th>
              <th>狀態</th>
              <th className="action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const Icon = categoryIcon(l.category);
              return (
                <tr key={l.id}>
                  <td>
                    <button
                      className="identity-link"
                      onClick={() => setModal({ type: "loan", loan: l })}
                    >
                      <Icon size={19} />
                      <span>
                        <strong>{l.equipment_name}</strong>
                        <small className="mono">{shortId(l.id)}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="person-cell">
                      <Avatar name={l.user_name} small />
                      <span>
                        {l.user_name}
                        <small>{l.department}</small>
                      </span>
                    </span>
                  </td>
                  <td className="date-cell">
                    <span>
                      {dateLabel(l.start)} <span className="muted">—</span>{" "}
                      {dateLabel(l.end)}
                    </span>
                    <small>
                      {Math.round(
                        (Date.parse(l.end) - Date.parse(l.start)) / 86400000,
                      ) + 1}{" "}
                      天
                    </small>
                  </td>
                  <td>
                    <Badge status={l.status} late={overdue(l)} />
                  </td>
                  <td className="action-cell">
                    {!overview && canApprove(u, l) ? (
                      <Button
                        className="compact"
                        onClick={() =>
                          setModal({
                            type: "decision",
                            loan: l,
                            action: "approve",
                          })
                        }
                      >
                        簽核
                      </Button>
                    ) : !overview && manage && l.status === "approved" ? (
                      <Button
                        className="compact"
                        onClick={() =>
                          setModal({
                            type: "decision",
                            loan: l,
                            action: "checkout",
                          })
                        }
                      >
                        辦理領用
                      </Button>
                    ) : !overview && manage && l.status === "borrowed" ? (
                      <Button
                        className="compact"
                        onClick={() =>
                          setModal({
                            type: "decision",
                            loan: l,
                            action: "return",
                          })
                        }
                      >
                        辦理歸還
                      </Button>
                    ) : (
                      <button
                        className="icon-button"
                        aria-label={`查看 ${l.equipment_name} 申請詳情`}
                        onClick={() => setModal({ type: "loan", loan: l })}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="沒有符合條件的申請"
        description="調整篩選條件，或建立一筆新的借用申請。"
      />
    );
  }
  const selectedLoan =
    modal && "loan" in modal
      ? data.loans.find((l) => l.id === modal.loan.id) || modal.loan
      : null;
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        跳至主要內容
      </a>
      {navOpen && (
        <button
          className="nav-backdrop"
          onClick={() => setNavOpen(false)}
          aria-label="關閉導覽"
        />
      )}
      <aside
        className={"sidebar " + (navOpen ? "open" : "")}
        aria-label="主要導覽"
      >
        <Brand />
        <div className="workspace">
          <span className="workspace-symbol">
            <Box size={17} />
          </span>
          <div>
            <strong>{data.settings.organization}</strong>
            <small>設備協作工作空間</small>
          </div>
          <ShieldCheck size={16} />
        </div>
        <div className="nav-label">工作空間</div>
        <nav>
          {accessible
            .filter((n) => !["audit", "settings"].includes(n.id))
            .map((n) => (
              <button
                key={n.id}
                className={"nav-item " + (current === n.id ? "active" : "")}
                onClick={() => navigate(n.id)}
                aria-current={current === n.id ? "page" : undefined}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {n.id === "approvals" && pending.length > 0 && (
                  <span className="nav-count">{pending.length}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="nav-label">管理與偏好</div>
        <nav>
          {accessible
            .filter((n) => ["audit", "settings"].includes(n.id))
            .map((n) => (
              <button
                key={n.id}
                className={"nav-item " + (current === n.id ? "active" : "")}
                onClick={() => navigate(n.id)}
                aria-current={current === n.id ? "page" : undefined}
              >
                <n.icon size={18} />
                {n.label}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={19} />
            <strong>每一次交接，都有跡可循。</strong>
            <p>讓設備流動，讓團隊專注。</p>
            <button
              className="text-button"
              onClick={() => setModal({ type: "help" })}
            >
              了解借還流程 <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="account-button"
            onClick={() => {
              setSettingsTab("profile");
              navigate("settings");
            }}
          >
            <Avatar name={u.name} />
            <span>
              <strong>{u.name}</strong>
              <small>{roles[u.role]}</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="開啟導覽"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            工作空間 <ChevronRight size={13} />
            <span>{nav.find((n) => n.id === current)?.label}</span>
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              id="global-search"
              aria-label="搜尋設備或申請"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="搜尋設備或申請…"
            />
            <kbd>Ctrl K</kbd>
            {globalSearch && (
              <div className="search-results">
                <small>設備與借用申請</small>
                {data.equipment
                  .filter((e) =>
                    (e.name + " " + e.code)
                      .toLowerCase()
                      .includes(globalSearch.toLowerCase()),
                  )
                  .slice(0, 4)
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setGlobalSearch("");
                        setModal({
                          type: manage ? "equipment" : "borrow",
                          equipment: e,
                        });
                      }}
                    >
                      <Package size={17} />
                      <span>
                        {e.name}
                        <small>{e.code}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                {data.loans
                  .filter((l) =>
                    (l.equipment_name + " " + l.user_name + " " + shortId(l.id))
                      .toLowerCase()
                      .includes(globalSearch.toLowerCase()),
                  )
                  .slice(0, 4)
                  .map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setGlobalSearch("");
                        setModal({ type: "loan", loan: l });
                      }}
                    >
                      <FileText size={17} />
                      <span>
                        {l.equipment_name}
                        <small>
                          {l.user_name}・{shortId(l.id)}
                        </small>
                      </span>
                    </button>
                  ))}
                <button
                  className="search-all"
                  onClick={() => {
                    const v = globalSearch;
                    if (page === "equipment") {
                      setSearch(v);
                      setGlobalSearch("");
                    } else {
                      nextSearch.current = v;
                      navigate("equipment");
                    }
                  }}
                >
                  在設備清單搜尋「{globalSearch}」<ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="top-actions">
            <button
              className="connection"
              onClick={() =>
                load()
                  .then(() => setToast("資料已更新"))
                  .catch((e) => setToast(e.message))
              }
              title="重新讀取最新資料"
            >
              <span />
              重新整理資料
            </button>
            <div className="notification-anchor">
              <button
                className="icon-button"
                onClick={() => setNotifications(!notifications)}
                aria-label={`通知中心，${notices.length} 則提醒`}
                aria-expanded={notifications}
              >
                <Bell size={19} />
                {notices.length > 0 && <i className="notification-dot" />}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <div className="panel-heading">
                    <h2>通知中心</h2>
                    <span>{notices.length} 則提醒</span>
                  </div>
                  {notices.length ? (
                    notices.slice(0, 10).map((n, i) => (
                      <button
                        className="notification-item"
                        key={i}
                        onClick={() => {
                          setModal({ type: "loan", loan: n.loan });
                          setNotifications(false);
                        }}
                      >
                        <small>{n.type}</small>
                        <strong>{n.title}</strong>
                        <span>{n.description}</span>
                      </button>
                    ))
                  ) : (
                    <p className="notice-empty">
                      所有事項都已處理，沒有新提醒。
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              className="top-avatar"
              aria-label={`開啟 ${u.name} 的帳號設定`}
              title={u.name}
              onClick={() => navigate("settings")}
            >
              <Avatar name={u.name} small />
              <span className="top-avatar-name">{u.name}</span>
            </button>
          </div>
        </header>
        <main className="sheet" id="main-content">
          <div className="content">
            {u.must_change === 1 && (
              <div className="notice warning">
                <LockKeyhole size={17} />
                <span>你目前使用臨時密碼，請先更新密碼再進行其他操作。</span>
                <button
                  className="text-button"
                  onClick={() => {
                    setSettingsTab("security");
                    navigate("settings");
                  }}
                >
                  更新密碼 <ArrowRight size={14} />
                </button>
              </div>
            )}
            {current === "dashboard" && (
              <>
                <Heading
                  eyebrow="設備管理 / Overview"
                  title="總覽儀錶板"
                  description={
                    late.length
                      ? `${pending.length} 筆申請等待簽核，${late.length} 台設備逾期未還，請優先處理。`
                      : "從申請到歸還，讓每一次交接都井然有序。"
                  }
                  action={
                    <Button
                      className="primary"
                      onClick={() => setModal({ type: "borrow" })}
                    >
                      <Plus size={17} />
                      新增借用申請
                    </Button>
                  }
                />
                <div className="overview-toolbar">
                  <div className="tabs">
                    <button className="selected">工作總覽</button>
                    <button onClick={() => navigate("reports")}>
                      使用分析 <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <span className="date-display">
                    <CalendarDays size={15} />
                    {new Intl.DateTimeFormat("zh-TW", {
                      timeZone: "Asia/Taipei",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    }).format(new Date())}
                  </span>
                </div>
                <div className="metrics">
                  <Metric
                    label="設備資產總數"
                    value={data.equipment.length}
                    unit="台"
                    note={`${categories.filter((c) => data.equipment.some((e) => e.category === c)).length} 種設備類別`}
                    onClick={() => navigate("equipment")}
                  />
                  <Metric
                    label="目前可供借用"
                    value={available.length}
                    unit="台"
                    note="不含已借出、維護與停用設備"
                    accent
                    onClick={() => navigate("equipment")}
                  />
                  <Metric
                    label="正在借用中"
                    value={borrowed.length}
                    unit="台"
                    note={`${due.length} 台設備將於 2 天內到期`}
                    onClick={() => navigate("loans")}
                  />
                  <Metric
                    label="待處理簽核"
                    value={pending.length}
                    unit="筆"
                    note={approver ? "等待你的審核" : "由授權主管進行審核"}
                    onClick={() => navigate(approver ? "approvals" : "loans")}
                  />
                </div>
                <div className="dashboard-grid">
                  <section className="panel trend-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>借用趨勢</h2>
                        <p>了解團隊近期的設備使用需求</p>
                      </div>
                      <Period value={period} onChange={setPeriod} />
                    </div>
                    <Trend loans={data.loans} days={period} />
                    <div className="chart-footer">
                      <span>
                        <i className="legend-dot" />
                        借用申請數
                      </span>
                      <span>
                        共{" "}
                        <strong>
                          {
                            data.loans.filter(
                              (l) =>
                                Date.parse(l.created) >=
                                Date.now() - period * 86400000,
                            ).length
                          }
                        </strong>{" "}
                        筆申請 <span className="muted">/ 近 {period} 天</span>
                      </span>
                    </div>
                  </section>
                  <section className="panel attention-panel">
                    <div className="panel-heading">
                      <h2>需要你的關注</h2>
                      <span className="count-tag">{notices.length}</span>
                    </div>
                    {notices.length ? (
                      <div className="attention-list">
                        {notices.slice(0, 2).map((n, i) => (
                          <button
                            key={i}
                            onClick={() =>
                              setModal({ type: "loan", loan: n.loan })
                            }
                            className="attention-item"
                          >
                            <div className="attention-title">
                              <span
                                className={
                                  "attention-marker " +
                                  (n.type === "逾期歸還" ? "red" : "")
                                }
                              />
                              <strong>{n.type}</strong>
                              <ChevronRight size={15} />
                            </div>
                            <span>{n.title}</span>
                            <small>{n.description}</small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="calm-state">
                        <CheckCircle2 size={28} />
                        <strong>一切安排妥當</strong>
                        <p>目前沒有待處理或即將到期的事項。</p>
                      </div>
                    )}
                    <button
                      className="panel-footer-link"
                      onClick={() => navigate(approver ? "approvals" : "loans")}
                    >
                      前往{approver ? "簽核中心" : "借還管理"}{" "}
                      <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="panel latest-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>近期借用動態</h2>
                        <p>最新申請與設備流向</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("loans")}
                      >
                        查看全部 <ArrowRight size={15} />
                      </button>
                    </div>
                    {loanTable(data.loans.slice(0, 4), true)}
                  </section>
                  <section className="panel distribution-panel">
                    <div className="panel-heading">
                      <h2>設備配置</h2>
                      <span className="muted">依類別</span>
                    </div>
                    <div className="category-breakdown">
                      {categories
                        .map((c) => ({
                          name: c,
                          count: data.equipment.filter((e) => e.category === c)
                            .length,
                        }))
                        .filter((x) => x.count)
                        .sort((a, b) => b.count - a.count)
                        .map((c, i) => (
                          <div key={c.name}>
                            <span>
                              {c.name}
                              <strong>
                                {c.count} <small>台</small>
                              </strong>
                            </span>
                            <div className="bar-track">
                              <div
                                style={{
                                  width: `${(c.count / Math.max(data.equipment.length, 1)) * 100}%`,
                                  opacity: 1 - i * 0.14,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                    {!data.equipment.length && (
                      <p className="muted">尚未新增設備。</p>
                    )}
                    <div className="maintenance-note">
                      <SlidersHorizontal size={16} />
                      <span>{maintenance.length} 台設備維護中</span>
                      <button
                        className="text-button"
                        onClick={() => navigate("equipment")}
                      >
                        查看 <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}
            {current === "equipment" && (
              <>
                <Heading
                  eyebrow="資產工作空間 / Equipment"
                  title="設備資產"
                  description="每一台設備，都有清楚的狀態與去向。"
                  action={
                    <Button
                      className="primary"
                      onClick={() =>
                        setModal({ type: manage ? "equipment" : "borrow" })
                      }
                    >
                      <Plus size={17} />
                      {manage ? "新增設備" : "新增借用申請"}
                    </Button>
                  }
                />
                <div className="tabs page-tabs">
                  {[
                    ["all", "全部設備", data.equipment.length],
                    ["ready", "可供借用", available.length],
                    [
                      "busy",
                      "借用中",
                      data.equipment.filter((e) => e.busy).length,
                    ],
                    ["maintenance", "維護中", maintenance.length],
                    [
                      "retired",
                      "已停用",
                      data.equipment.filter((e) => e.condition === "retired")
                        .length,
                    ],
                  ].map(([id, label, count]) => (
                    <button
                      key={id}
                      className={filter === id ? "selected" : ""}
                      onClick={() => {
                        setFilter(String(id));
                        setLimit(10);
                      }}
                    >
                      {label}
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
                <div className="list-toolbar">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="搜尋設備名稱、編號或位置"
                  />
                  <select
                    aria-label="設備類別"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">所有類別</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <span className="toolbar-count">
                    共 {eqRows.length} 台設備
                  </span>
                  <div className="view-toggle">
                    <button
                      aria-label="表格檢視"
                      aria-pressed={!grid}
                      className={!grid ? "selected" : ""}
                      onClick={() => setGrid(false)}
                    >
                      <Menu size={17} />
                    </button>
                    <button
                      aria-label="卡片檢視"
                      aria-pressed={grid}
                      className={grid ? "selected" : ""}
                      onClick={() => setGrid(true)}
                    >
                      <LayoutDashboard size={17} />
                    </button>
                  </div>
                  <Button
                    onClick={() =>
                      exportCsv(
                        "BFT-設備清單-" + today,
                        [
                          "設備編號",
                          "名稱",
                          "類別",
                          "品牌",
                          "型號",
                          "序號",
                          "位置",
                          "狀態",
                          "配件與備註",
                        ],
                        eqRows.map((e) => [
                          e.code,
                          e.name,
                          e.category,
                          e.brand,
                          e.model,
                          e.serial,
                          e.location,
                          e.condition === "ready"
                            ? e.busy
                              ? "借用中"
                              : "可供借用"
                            : e.condition === "maintenance"
                              ? "維護中"
                              : "已停用",
                          e.notes,
                        ]),
                      )
                    }
                  >
                    <Download size={15} />
                    匯出
                  </Button>
                </div>
                {eqRows.length ? (
                  grid ? (
                    <div className="equipment-grid">
                      {eqRows.slice(0, limit).map((e) => {
                        const Icon = categoryIcon(e.category);
                        return (
                          <article className="equipment-card" key={e.id}>
                            <div className="equipment-card-visual">
                              <DeviceDrawing category={e.category} />
                              <Badge
                                status={
                                  e.condition === "ready" && e.busy
                                    ? "busy"
                                    : e.condition
                                }
                              />
                            </div>
                            <div className="equipment-card-content">
                              <small className="mono">{e.code}</small>
                              <h2>{e.name}</h2>
                              <p>
                                {e.brand} {e.model}
                              </p>
                              <span className="muted">
                                <Icon size={14} />
                                {e.category} · {e.location}
                              </span>
                              <div className="equipment-card-actions">
                                <Button
                                  disabled={e.condition !== "ready"}
                                  onClick={() =>
                                    setModal({ type: "borrow", equipment: e })
                                  }
                                >
                                  查看可借時段 <ArrowUpRight size={14} />
                                </Button>
                                {manage && (
                                  <button
                                    className="icon-button"
                                    aria-label={`編輯 ${e.name}`}
                                    onClick={() =>
                                      setModal({
                                        type: "equipment",
                                        equipment: e,
                                      })
                                    }
                                  >
                                    <MoreHorizontal size={18} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table className="equipment-table">
                        <thead>
                          <tr>
                            <th>設備名稱 / 編號</th>
                            <th>類別</th>
                            <th>存放位置</th>
                            <th>目前狀態</th>
                            <th className="action-cell">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eqRows.slice(0, limit).map((e) => {
                            const Icon = categoryIcon(e.category);
                            return (
                              <tr key={e.id}>
                                <td>
                                  <div className="device-cell">
                                    <div className="device-thumb">
                                      <Icon size={25} />
                                    </div>
                                    <div>
                                      <strong>{e.name}</strong>
                                      <small className="mono">
                                        {e.code}
                                        <span className="model-text">
                                          {" "}
                                          · {e.brand} {e.model}
                                        </span>
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td>{e.category}</td>
                                <td>{e.location}</td>
                                <td>
                                  <Badge
                                    status={
                                      e.condition === "ready" && e.busy
                                        ? "busy"
                                        : e.condition
                                    }
                                  />
                                </td>
                                <td className="action-cell">
                                  <div className="row-actions">
                                    <Button
                                      className="compact"
                                      disabled={e.condition !== "ready"}
                                      onClick={() =>
                                        setModal({
                                          type: "borrow",
                                          equipment: e,
                                        })
                                      }
                                    >
                                      申請借用
                                    </Button>
                                    {manage && (
                                      <button
                                        className="icon-button"
                                        aria-label={`編輯 ${e.name}`}
                                        onClick={() =>
                                          setModal({
                                            type: "equipment",
                                            equipment: e,
                                          })
                                        }
                                      >
                                        <MoreHorizontal size={18} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <Empty
                    title="沒有符合條件的設備"
                    description="調整搜尋條件，或新增你的第一台設備。"
                    action={
                      manage && (
                        <Button onClick={() => setModal({ type: "equipment" })}>
                          <Plus size={16} />
                          新增設備
                        </Button>
                      )
                    }
                  />
                )}
                <Pagination
                  limit={limit}
                  total={eqRows.length}
                  setLimit={setLimit}
                />
              </>
            )}
            {(current === "loans" || current === "approvals") && (
              <>
                <Heading
                  eyebrow={
                    current === "approvals"
                      ? "審核工作空間 / Approvals"
                      : "借還工作空間 / Lending"
                  }
                  title={current === "approvals" ? "簽核中心" : "借還管理"}
                  description={
                    current === "approvals"
                      ? "讓每一次借用都有依據，為團隊把好每一道關。"
                      : "從提出需求到設備歸位，完整追蹤每一筆借用。"
                  }
                  action={
                    current === "loans" ? (
                      <Button
                        className="primary"
                        onClick={() => setModal({ type: "borrow" })}
                      >
                        <Plus size={17} />
                        新增借用申請
                      </Button>
                    ) : (
                      <span className="permission-hint">
                        <ShieldCheck size={16} />
                        {isAdmin
                          ? "所有部門簽核權限"
                          : u.department + "簽核權限"}
                      </span>
                    )
                  }
                />
                {current === "approvals" && (
                  <div className="notice">
                    <ShieldCheck size={17} />
                    <span>
                      依權限審核部門申請；為確保簽核公正，你無法簽核自己的借用申請。
                    </span>
                  </div>
                )}
                <div className="tabs page-tabs">
                  {(current === "loans"
                    ? [
                        ["all", "全部申請"],
                        ["mine", "我的申請"],
                        ["pending", "待簽核"],
                        ["approved", "待領用"],
                        ["borrowed", "借用中"],
                        ["overdue", "已逾期"],
                        ["returned", "已歸還"],
                        ["rejected", "已駁回"],
                        ["cancelled", "已取消"],
                      ]
                    : [
                        ["all", "待我簽核"],
                        ["done", "已完成簽核"],
                        ["mine", "我的簽核紀錄"],
                      ]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? "selected" : ""}
                      onClick={() => {
                        setFilter(id);
                        setLimit(10);
                      }}
                    >
                      {label}
                      {id === "all" && current === "approvals" && (
                        <span>{pending.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="list-toolbar">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="搜尋設備、申請人或申請編號"
                  />
                  <span className="toolbar-count">
                    共 {(current === "loans" ? loanRows : approvalRows).length}{" "}
                    筆申請
                  </span>
                  <Button
                    onClick={() =>
                      exportLoans(current === "loans" ? loanRows : approvalRows)
                    }
                  >
                    <Download size={15} />
                    匯出紀錄
                  </Button>
                </div>
                {loanTable(
                  (current === "loans" ? loanRows : approvalRows).slice(
                    0,
                    limit,
                  ),
                )}
                <Pagination
                  limit={limit}
                  total={(current === "loans" ? loanRows : approvalRows).length}
                  setLimit={setLimit}
                />
              </>
            )}
            {current === "reports" && (
              <>
                <Heading
                  eyebrow="使用洞察 / Analytics"
                  title="設備使用分析"
                  description="從借用紀錄看見設備需求，讓資源配置更有依據。"
                  action={
                    <Button onClick={() => exportLoans(data.loans)}>
                      <Download size={16} />
                      匯出借用報表
                    </Button>
                  }
                />
                <div className="notice">
                  <ShieldCheck size={16} />
                  <span>
                    報表範圍：
                    {u.role === "employee"
                      ? "你的個人借用紀錄"
                      : u.role === "approver"
                        ? `${u.department}及個人的借用紀錄`
                        : "所有部門的借用紀錄"}
                    。設備資產為全公司共用清單。
                  </span>
                </div>
                <div className="metrics">
                  <Metric
                    label="累計借用申請"
                    value={data.loans.length}
                    unit="筆"
                    note="目前權限可見的所有申請"
                  />
                  <Metric
                    label="已完成借還"
                    value={
                      data.loans.filter((l) => l.status === "returned").length
                    }
                    unit="筆"
                    note="已完成歸還點交"
                  />
                  <Metric
                    label="準時歸還率"
                    value={(() => {
                      const r = data.loans.filter(
                        (l) => l.status === "returned",
                      );
                      return r.length
                        ? Math.round(
                            (r.filter(
                              (l) =>
                                l.returned &&
                                taipeiDate(new Date(l.returned)) <= l.end,
                            ).length /
                              r.length) *
                              100,
                          )
                        : 0;
                    })()}
                    unit="%"
                    note="於期限內完成歸還的比例"
                    accent
                  />
                  <Metric
                    label="逾期未歸還"
                    value={late.length}
                    unit="筆"
                    note="目前借用中且超過期限"
                  />
                </div>
                <div className="report-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>借用需求趨勢</h2>
                      <Period value={period} onChange={setPeriod} />
                    </div>
                    <Trend loans={data.loans} days={period} />
                    <div className="chart-footer">
                      <span>
                        <i className="legend-dot" />
                        借用申請數
                      </span>
                      <span>含各狀態申請</span>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>設備借用排行</h2>
                      <span className="muted">累計次數</span>
                    </div>
                    <div className="ranking">
                      {data.equipment
                        .map((e) => ({
                          ...e,
                          count: data.loans.filter(
                            (l) =>
                              l.equipment_id === e.id &&
                              !["cancelled", "rejected"].includes(l.status),
                          ).length,
                        }))
                        .filter((e) => e.count)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                        .map((e, i) => (
                          <div key={e.id}>
                            <span className="rank-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>
                              {e.name}
                              <small>{e.category}</small>
                            </span>
                            <strong>
                              {e.count}
                              <small> 次</small>
                            </strong>
                          </div>
                        ))}
                      {!data.loans.length && (
                        <Empty
                          title="尚無借用資料"
                          description="完成借用後，排行將自動更新。"
                        />
                      )}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>部門借用分布</h2>
                      <span className="muted">依申請時部門</span>
                    </div>
                    <div className="department-bars">
                      {[...new Set(data.loans.map((l) => l.department))]
                        .map((d) => ({
                          name: d,
                          count: data.loans.filter((l) => l.department === d)
                            .length,
                        }))
                        .sort((a, b) => b.count - a.count)
                        .map((d) => (
                          <div key={d.name}>
                            <span>
                              {d.name}
                              <strong>{d.count} 筆</strong>
                            </span>
                            <div className="bar-track">
                              <div
                                style={{
                                  width: `${(d.count / Math.max(data.loans.length, 1)) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      {!data.loans.length && (
                        <p className="muted">尚無部門申請紀錄。</p>
                      )}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>申請處理狀態</h2>
                      <span className="muted">所有紀錄</span>
                    </div>
                    <div className="status-breakdown">
                      {Object.entries(statusNames).map(([s]) => (
                        <div key={s}>
                          <Badge status={s} />
                          <strong>
                            {data.loans.filter((l) => l.status === s).length}
                            <small> 筆</small>
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}
            {current === "users" && (
              <>
                <Heading
                  eyebrow="團隊管理 / Members"
                  title="成員與權限"
                  description="為每一位夥伴設定合適的權限，讓協作有序、安全。"
                  action={
                    <Button
                      className="primary"
                      onClick={() => setModal({ type: "user" })}
                    >
                      <Plus size={17} />
                      新增成員
                    </Button>
                  }
                />
                <div className="role-summary">
                  {Object.entries(roles).map(([r, name]) => (
                    <button
                      key={r}
                      className={filter === r ? "selected" : ""}
                      onClick={() => setFilter(filter === r ? "all" : r)}
                    >
                      <ShieldCheck size={17} />
                      <span>
                        {name}
                        <small>
                          {r === "employee"
                            ? "申請借用、檢視個人紀錄"
                            : r === "approver"
                              ? "部門簽核、檢視部門紀錄"
                              : r === "custodian"
                                ? "管理設備、辦理領用歸還"
                                : "管理系統、成員與所有設備"}
                        </small>
                      </span>
                      <strong>
                        {
                          data.users.filter((x) => x.role === r && x.active)
                            .length
                        }
                      </strong>
                    </button>
                  ))}
                </div>
                <div className="list-toolbar">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="搜尋姓名、帳號或部門"
                  />
                  <select
                    aria-label="成員狀態"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">所有狀態</option>
                    <option value="active">啟用中</option>
                    <option value="inactive">已停用</option>
                  </select>
                  <span className="toolbar-count">
                    共 {userRows.length} 位成員
                  </span>
                </div>
                {userRows.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>成員 / 帳號</th>
                          <th>所屬部門</th>
                          <th>權限角色</th>
                          <th>帳號狀態</th>
                          <th className="action-cell">管理</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userRows.map((x) => (
                          <tr key={x.id}>
                            <td>
                              <span className="person-cell">
                                <Avatar name={x.name} />
                                <span>
                                  <strong>
                                    {x.name}
                                    {x.id === u.id && (
                                      <span className="you-tag">你</span>
                                    )}
                                  </strong>
                                  <small>{x.username}</small>
                                </span>
                              </span>
                            </td>
                            <td>{x.department}</td>
                            <td>{roles[x.role]}</td>
                            <td>
                              <span
                                className={
                                  "badge " + (x.active ? "ready" : "retired")
                                }
                              >
                                <span className="status-dot" />
                                {x.active ? "啟用中" : "已停用"}
                              </span>
                            </td>
                            <td className="action-cell">
                              <Button
                                className="compact"
                                onClick={() =>
                                  x.id === u.id
                                    ? navigate("settings")
                                    : setModal({ type: "user", user: x })
                                }
                              >
                                {x.id === u.id ? "帳號設定" : "編輯權限"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="沒有符合條件的成員"
                    description="試試其他關鍵字或篩選條件。"
                  />
                )}
              </>
            )}
            {current === "audit" && (
              <>
                <Heading
                  eyebrow="系統足跡 / Activity"
                  title="操作紀錄"
                  description="保留每一次關鍵操作，讓設備交接與權限變更可供追溯。"
                  action={
                    <Button
                      onClick={() =>
                        exportCsv(
                          "BFT-操作紀錄-" + today,
                          [
                            "時間",
                            "操作人",
                            "操作內容",
                            "詳細資訊",
                            "紀錄目標",
                          ],
                          auditRows.map((e) => [
                            timeLabel(e.created),
                            e.actor_name,
                            e.action,
                            e.detail,
                            e.target,
                          ]),
                        )
                      }
                    >
                      <Download size={16} />
                      匯出紀錄
                    </Button>
                  }
                />
                <div className="list-toolbar">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="搜尋操作人、操作或詳細資訊"
                  />
                  <span className="toolbar-count">
                    最近 200 筆權限範圍內紀錄
                  </span>
                </div>
                {auditRows.length ? (
                  <div className="table-scroll">
                    <table className="audit-table">
                      <thead>
                        <tr>
                          <th>操作時間（台北）</th>
                          <th>操作人</th>
                          <th>操作內容</th>
                          <th>詳細資訊</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditRows.slice(0, limit).map((e) => (
                          <tr key={e.id}>
                            <td className="mono">{timeLabel(e.created)}</td>
                            <td>{e.actor_name}</td>
                            <td>
                              <strong>{e.action}</strong>
                            </td>
                            <td className="audit-detail">{e.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="沒有符合條件的操作紀錄"
                    description="試試其他關鍵字。"
                  />
                )}
                <Pagination
                  limit={limit}
                  total={auditRows.length}
                  setLimit={setLimit}
                />
              </>
            )}
            {current === "settings" && (
              <>
                <Heading
                  eyebrow="個人與組織 / Settings"
                  title="帳號與設定"
                  description="管理你的個人資料、登入安全與工作空間偏好。"
                  action={
                    <Button
                      className="danger-outline"
                      disabled={busy}
                      onClick={() => mutate("logout", "POST", {}, "已安全登出")}
                    >
                      <LogOut size={16} />
                      登出帳號
                    </Button>
                  }
                />
                <div className="tabs page-tabs">
                  {[
                    ["profile", "個人資料"],
                    ["security", "帳號安全"],
                    ...(isAdmin ? [["system", "系統設定"]] : []),
                  ].map(([key, label]) => (
                    <button
                      className={settingsTab === key ? "selected" : ""}
                      key={key}
                      onClick={() => {
                        setSettingsTab(key);
                        setFormError("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {(settingsTab === "profile" || settingsTab === "security") && (
                  <div className="settings-layout">
                    <div className="settings-description">
                      <h2>
                        {settingsTab === "profile"
                          ? "個人資料"
                          : "登入帳號與密碼"}
                      </h2>
                      <p>
                        {settingsTab === "profile"
                          ? "保持聯絡資訊正確，讓交接更順暢。"
                          : "更新後將登出其他裝置，保護你的帳號安全。"}
                      </p>
                      <div className="profile-summary">
                        <Avatar name={u.name} />
                        <strong>{u.name}</strong>
                        <span>{u.department}</span>
                        <span className="badge neutral">{roles[u.role]}</span>
                      </div>
                    </div>
                    <form
                      className="settings-form"
                      key={settingsTab}
                      onSubmit={(e) => {
                        const form = e.currentTarget;
                        submit(e, (b) => {
                          if (
                            settingsTab === "security" &&
                            b.newPassword !== b.confirmPassword
                          ) {
                            setFormError("兩次輸入的新密碼不一致");
                            return;
                          }
                          mutate(
                            "account",
                            "PUT",
                            {
                              username: b.username || u.username,
                              name: b.name || u.name,
                              email: b.email ?? u.email,
                              currentPassword: b.currentPassword,
                              ...(b.newPassword
                                ? { newPassword: b.newPassword }
                                : {}),
                            },
                            "帳號資料已儲存，其他登入已撤銷",
                            false,
                          ).then((ok) => {
                            if (ok) form.reset();
                          });
                        });
                      }}
                    >
                      {formAlert}
                      {settingsTab === "profile" ? (
                        <>
                          <div className="form-grid">
                            <Field label="顯示名稱">
                              <input
                                name="name"
                                defaultValue={u.name}
                                required
                                maxLength={60}
                              />
                            </Field>
                            <Field label="聯絡電子郵件">
                              <input
                                name="email"
                                type="email"
                                defaultValue={u.email}
                                maxLength={254}
                              />
                            </Field>
                          </div>
                          <Field
                            label="部門"
                            hint="部門與權限由系統管理員維護。"
                          >
                            <input value={u.department} readOnly />
                          </Field>
                        </>
                      ) : (
                        <>
                          <Field
                            label="登入帳號"
                            hint="3–40 字元，英文、數字、點、底線或連字號。"
                          >
                            <input
                              name="username"
                              defaultValue={u.username}
                              required
                              minLength={3}
                              maxLength={40}
                              autoComplete="username"
                              pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}"
                            />
                          </Field>
                          <div className="form-grid">
                            <Field
                              label="新密碼"
                              hint="至少 12 字元，需包含英文字母及數字。"
                            >
                              <input
                                name="newPassword"
                                type="password"
                                required
                                minLength={12}
                                maxLength={128}
                                autoComplete="new-password"
                              />
                            </Field>
                            <Field label="確認新密碼">
                              <input
                                name="confirmPassword"
                                type="password"
                                required
                                minLength={12}
                                maxLength={128}
                                autoComplete="new-password"
                              />
                            </Field>
                          </div>
                        </>
                      )}
                      <Field
                        label="目前密碼"
                        hint="儲存變更前，需要驗證你的身分。"
                      >
                        <input
                          name="currentPassword"
                          type="password"
                          autoComplete="current-password"
                          required
                          maxLength={128}
                        />
                      </Field>
                      <div className="form-actions">
                        <Button
                          className="primary"
                          disabled={busy}
                          type="submit"
                        >
                          {busy ? (
                            <span className="spinner" />
                          ) : (
                            <Check size={16} />
                          )}
                          儲存變更
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
                {settingsTab === "system" && isAdmin && (
                  <>
                    <div className="settings-layout">
                      <div className="settings-description">
                        <h2>工作空間設定</h2>
                        <p>設定組織名稱與借用規則，變更適用於後續新申請。</p>
                      </div>
                      <form
                        className="settings-form"
                        onSubmit={(e) =>
                          submit(e, (b) =>
                            mutate(
                              "settings",
                              "PUT",
                              b,
                              "系統設定已儲存",
                              false,
                            ),
                          )
                        }
                      >
                        {formAlert}
                        <Field label="工作空間名稱">
                          <input
                            name="organization"
                            defaultValue={data.settings.organization}
                            required
                            maxLength={60}
                          />
                        </Field>
                        <Field
                          label="最長借用天數"
                          hint="包含借用當日，範圍為 1–90 天。"
                        >
                          <input
                            type="number"
                            name="maxDays"
                            defaultValue={data.settings.maxDays}
                            required
                            min={1}
                            max={90}
                          />
                        </Field>
                        <div className="rule-preview">
                          <ShieldCheck size={18} />
                          <div>
                            <strong>借還規則</strong>
                            <p>
                              申請 → 主管簽核 → 管理員領用點交 →
                              歸還檢查。所有申請皆須簽核，禁止自行核准。
                            </p>
                          </div>
                        </div>
                        <div className="form-actions">
                          <Button className="primary" disabled={busy}>
                            儲存設定
                          </Button>
                        </div>
                      </form>
                    </div>
                    {!data.equipment.length && (
                      <div className="settings-layout">
                        <div className="settings-description">
                          <h2>範例資料</h2>
                          <p>
                            加入 12
                            台設備與完整借還紀錄，快速體驗流程。範例成員預設停用。
                          </p>
                        </div>
                        <div className="settings-form">
                          <Button
                            disabled={busy}
                            onClick={() =>
                              mutate(
                                "sample",
                                "POST",
                                {},
                                "範例資料已載入",
                                false,
                              )
                            }
                          >
                            載入範例資料
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <footer className="app-footer">
              <span>
                BFT 設備管理 <span className="footer-divider">/</span>{" "}
                讓每一次借還井然有序
              </span>
              <span>
                {data.sample && (
                  <span className="sample-label">含範例資料</span>
                )}
                Asia / Taipei <span className="footer-divider">·</span>
                <button onClick={() => setModal({ type: "help" })}>
                  使用指南 <CircleHelp size={13} />
                </button>
              </span>
            </footer>
          </div>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal?.type === "help" && (
        <Dialog title="設備借還使用指南" onClose={() => setModal(null)}>
          <div className="dialog-body">
            <p className="muted">一個清楚的流程，讓設備使用更安心。</p>
            <div className="help-steps">
              {[
                [
                  "提出借用申請",
                  "選擇設備與日期，填寫用途。系統會檢查時段衝突，待簽核申請亦保留時段。",
                ],
                [
                  "主管審核",
                  "部門主管或系統管理員核准申請；申請人不得簽核自己的申請。",
                ],
                [
                  "設備點交領用",
                  "於核准借用期間，由設備管理員確認設備及配件後辦理領用。",
                ],
                [
                  "歸還檢查",
                  "設備管理員填寫檢查紀錄並辦理歸還，設備重新開放借用。",
                ],
              ].map(([t, d], i) => (
                <div key={t}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <section>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </section>
                </div>
              ))}
            </div>
            <div className="notice">
              <Clock3 size={17} />
              <span>
                逾期狀態自動顯示於清單及通知中心；目前不寄送外部郵件。
              </span>
            </div>
          </div>
        </Dialog>
      )}
      {modal?.type === "borrow" && (
        <Dialog title="新增借用申請" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) =>
              submit(e, (b) =>
                mutate("loans", "POST", b, "借用申請已送出，等待主管簽核"),
              )
            }
          >
            <div className="dialog-body">
              {formAlert}
              <div className="notice">
                <ClipboardCheck size={17} />
                <span>
                  送出後須經主管簽核，借用最長 {data.settings.maxDays} 天。
                </span>
              </div>
              <Field label="選擇設備">
                <select
                  name="equipment_id"
                  required
                  defaultValue={modal.equipment?.id || ""}
                  onChange={(e) =>
                    setModal({
                      type: "borrow",
                      equipment: data.equipment.find(
                        (x) => x.id === e.target.value,
                      ),
                    })
                  }
                >
                  <option value="" disabled>
                    請選擇要借用的設備
                  </option>
                  {data.equipment
                    .filter((e) => e.condition === "ready")
                    .map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.name} · {e.code}
                        {e.busy ? "（目前借用中）" : ""}
                      </option>
                    ))}
                </select>
              </Field>
              {modal.equipment && (
                <div className="equipment-context">
                  <strong>
                    {modal.equipment.brand} {modal.equipment.model}
                  </strong>
                  <p>{modal.equipment.location}</p>
                  <small>{modal.equipment.notes}</small>
                  <div className="availability">
                    <Clock3 size={14} />
                    <span>
                      已佔用時段：
                      {data.loans
                        .filter(
                          (l) =>
                            l.equipment_id === modal.equipment?.id &&
                            ["pending", "approved", "borrowed"].includes(
                              l.status,
                            ),
                        )
                        .map((l) => dateLabel(l.start) + "–" + dateLabel(l.end))
                        .join("、") || "目前無可見預約；送出時將再次確認"}
                    </span>
                  </div>
                  {u.role === "employee" && (
                    <small>
                      其他同仁的預約由伺服器確認；若時段衝突會保留表單並提示。
                    </small>
                  )}
                </div>
              )}
              <div className="form-grid">
                <Field label="借用日期">
                  <input
                    name="start"
                    type="date"
                    min={today}
                    defaultValue={today}
                    required
                  />
                </Field>
                <Field label="預計歸還日期">
                  <input
                    name="end"
                    type="date"
                    min={today}
                    defaultValue={today}
                    required
                  />
                </Field>
              </div>
              <Field label="借用用途" hint="請具體說明使用情境，方便主管審核。">
                <textarea
                  name="purpose"
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="例如：品牌提案簡報，於台北客戶辦公室使用"
                />
              </Field>
              <div className="borrower-line">
                <Avatar name={u.name} small />
                <span>
                  {u.name} · {u.department}
                </span>
                <span className="muted">申請人</span>
              </div>
            </div>
            <div className="dialog-footer">
              <Button type="button" onClick={() => setModal(null)}>
                取消
              </Button>
              <Button
                className="primary"
                disabled={
                  busy || !data.equipment.some((e) => e.condition === "ready")
                }
              >
                {busy ? (
                  <span className="spinner" />
                ) : (
                  <ArrowUpRight size={16} />
                )}
                送出申請
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {modal?.type === "equipment" && manage && (
        <Dialog
          title={modal.equipment ? "編輯設備資料" : "新增設備"}
          onClose={() => setModal(null)}
          wide
        >
          <form
            onSubmit={(e) =>
              submit(e, (b) =>
                mutate(
                  "equipment" +
                    (modal.equipment ? "/" + modal.equipment.id : ""),
                  modal.equipment ? "PUT" : "POST",
                  b,
                  modal.equipment ? "設備資料已更新" : "設備已新增",
                ),
              )
            }
          >
            <div className="dialog-body">
              {formAlert}
              <div className="form-grid">
                <Field label="設備名稱">
                  <input
                    name="name"
                    defaultValue={modal.equipment?.name}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="資產編號" hint="每台設備須有唯一編號。">
                  <input
                    name="code"
                    defaultValue={modal.equipment?.code}
                    required
                    maxLength={40}
                    placeholder="BFT-NB-001"
                  />
                </Field>
                <Field label="設備類別">
                  <select
                    name="category"
                    defaultValue={modal.equipment?.category || categories[0]}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="設備狀態">
                  <select
                    name="condition"
                    defaultValue={modal.equipment?.condition || "ready"}
                  >
                    <option value="ready">正常開放借用</option>
                    <option value="maintenance">維護中</option>
                    <option value="retired">停用 / 除役</option>
                  </select>
                </Field>
                <Field label="品牌">
                  <input
                    name="brand"
                    defaultValue={modal.equipment?.brand}
                    maxLength={50}
                  />
                </Field>
                <Field label="型號 / 規格">
                  <input
                    name="model"
                    defaultValue={modal.equipment?.model}
                    maxLength={100}
                  />
                </Field>
                <Field label="設備序號">
                  <input
                    name="serial"
                    defaultValue={modal.equipment?.serial}
                    maxLength={100}
                  />
                </Field>
                <Field label="存放位置">
                  <input
                    name="location"
                    defaultValue={modal.equipment?.location}
                    required
                    maxLength={100}
                  />
                </Field>
              </div>
              <Field label="隨附配件與備註">
                <textarea
                  name="notes"
                  defaultValue={modal.equipment?.notes}
                  rows={3}
                  maxLength={1000}
                />
              </Field>
              <p className="form-hint">
                仍有待簽核、待領用或借用中的設備，完成借還前無法轉為維護或停用。
              </p>
            </div>
            <div className="dialog-footer">
              <Button type="button" onClick={() => setModal(null)}>
                取消
              </Button>
              <Button className="primary" disabled={busy}>
                {busy ? <span className="spinner" /> : <Check size={16} />}
                儲存設備
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {modal?.type === "loan" && selectedLoan && (
        <Dialog title="借用申請詳情" onClose={() => setModal(null)} wide>
          <div className="dialog-body">
            <div className="loan-detail-title">
              <div>
                <small className="mono">{shortId(selectedLoan.id)}</small>
                <h3>{selectedLoan.equipment_name}</h3>
                <span className="muted">{selectedLoan.code}</span>
              </div>
              <Badge
                status={selectedLoan.status}
                late={overdue(selectedLoan)}
              />
            </div>
            <div className="detail-grid">
              <div>
                <small>借用人 / 部門</small>
                <strong>
                  {selectedLoan.user_name} · {selectedLoan.department}
                </strong>
              </div>
              <div>
                <small>申請時間</small>
                <strong>{timeLabel(selectedLoan.created)}</strong>
              </div>
              <div>
                <small>借用日期</small>
                <strong>{dateLabel(selectedLoan.start, true)}</strong>
              </div>
              <div>
                <small>預計歸還</small>
                <strong>{dateLabel(selectedLoan.end, true)}</strong>
              </div>
            </div>
            <div className="detail-purpose">
              <small>借用用途</small>
              <p>{selectedLoan.purpose}</p>
            </div>
            <h3 className="section-label">申請歷程</h3>
            <div className="timeline">
              <TimelineStep
                title="借用申請已送出"
                detail={`${selectedLoan.user_name} · ${timeLabel(selectedLoan.created)}`}
                done
              />
              <TimelineStep
                title={
                  selectedLoan.status === "rejected"
                    ? "申請已駁回"
                    : selectedLoan.approver_id
                      ? "主管已核准"
                      : "等待主管簽核"
                }
                detail={
                  selectedLoan.approver_name
                    ? `${selectedLoan.approver_name} · ${selectedLoan.decision_note || "已審核"}`
                    : "由部門主管或系統管理員審核"
                }
                done={!!selectedLoan.approver_id}
              />
              <TimelineStep
                title={selectedLoan.checked_out ? "設備已領用" : "設備點交領用"}
                detail={
                  selectedLoan.checked_out
                    ? timeLabel(selectedLoan.checked_out)
                    : "核准後於借用期間辦理"
                }
                done={!!selectedLoan.checked_out}
              />
              <TimelineStep
                title={selectedLoan.returned ? "設備已歸還" : "歸還與檢查"}
                detail={
                  selectedLoan.returned
                    ? `${timeLabel(selectedLoan.returned)} · ${selectedLoan.return_note}`
                    : "由設備管理員確認設備及配件"
                }
                done={!!selectedLoan.returned}
              />
              {selectedLoan.status === "cancelled" && (
                <p className="muted">
                  此申請已於 {timeLabel(selectedLoan.updated)} 取消。
                </p>
              )}
            </div>
          </div>
          <div className="dialog-footer">
            {(selectedLoan.user_id === u.id || isAdmin) &&
              ["pending", "approved"].includes(selectedLoan.status) && (
                <Button
                  className="danger-outline push-left"
                  onClick={() =>
                    setModal({
                      type: "decision",
                      loan: selectedLoan,
                      action: "cancel",
                    })
                  }
                >
                  取消申請
                </Button>
              )}
            <Button onClick={() => setModal(null)}>關閉</Button>
            {canApprove(u, selectedLoan) && (
              <>
                <Button
                  className="danger-outline"
                  onClick={() =>
                    setModal({
                      type: "decision",
                      loan: selectedLoan,
                      action: "reject",
                    })
                  }
                >
                  駁回
                </Button>
                <Button
                  className="primary"
                  onClick={() =>
                    setModal({
                      type: "decision",
                      loan: selectedLoan,
                      action: "approve",
                    })
                  }
                >
                  <Check size={16} />
                  核准申請
                </Button>
              </>
            )}
            {manage && selectedLoan.status === "approved" && (
              <Button
                className="primary"
                onClick={() =>
                  setModal({
                    type: "decision",
                    loan: selectedLoan,
                    action: "checkout",
                  })
                }
              >
                辦理領用 <ArrowUpRight size={16} />
              </Button>
            )}
            {manage && selectedLoan.status === "borrowed" && (
              <Button
                className="primary"
                onClick={() =>
                  setModal({
                    type: "decision",
                    loan: selectedLoan,
                    action: "return",
                  })
                }
              >
                辦理歸還 <ArrowDownLeft size={16} />
              </Button>
            )}
          </div>
        </Dialog>
      )}
      {modal?.type === "decision" && selectedLoan && (
        <Dialog
          title={
            (
              {
                approve: "簽核借用申請",
                reject: "駁回借用申請",
                checkout: "辦理設備領用",
                return: "辦理設備歸還",
                cancel: "取消借用申請",
              } as Record<string, string>
            )[modal.action]
          }
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) =>
              submit(e, (b) =>
                mutate(
                  `loans/${selectedLoan.id}/${modal.action}`,
                  "POST",
                  b,
                  (
                    {
                      approve: "借用申請已核准",
                      reject: "借用申請已駁回",
                      checkout: "已完成設備領用",
                      return: "已完成設備歸還",
                      cancel: "借用申請已取消",
                    } as Record<string, string>
                  )[modal.action],
                ),
              )
            }
          >
            <div className="dialog-body">
              {formAlert}
              <div className="decision-summary">
                <Package size={25} />
                <div>
                  <strong>{selectedLoan.equipment_name}</strong>
                  <p>
                    {selectedLoan.user_name} · {dateLabel(selectedLoan.start)} —{" "}
                    {dateLabel(selectedLoan.end)}
                  </p>
                </div>
              </div>
              <div className="detail-purpose">
                <small>借用用途</small>
                <p>{selectedLoan.purpose}</p>
              </div>
              <Field
                label={
                  modal.action === "return"
                    ? "歸還檢查紀錄（必填）"
                    : modal.action === "reject"
                      ? "駁回原因（必填）"
                      : "處理意見 / 點交備註"
                }
                hint={
                  modal.action === "return"
                    ? "請確認外觀、功能及配件；有損壞可於歸還後將設備設為維護中。"
                    : undefined
                }
              >
                <textarea
                  name="note"
                  rows={3}
                  required={["return", "reject"].includes(modal.action)}
                  maxLength={1000}
                  placeholder={
                    modal.action === "return"
                      ? "例如：功能正常，充電器及保護套皆已歸還。"
                      : "填寫處理意見…"
                  }
                />
              </Field>
              {modal.action === "checkout" && (
                <div className="notice">
                  <Clock3 size={17} />
                  <span>
                    請確認身分、設備與配件。僅能在核准的借用期間領用。
                  </span>
                </div>
              )}
              {modal.action === "cancel" && (
                <div className="notice warning">
                  <AlertCircle size={17} />
                  <span>取消後將釋出預約時段，若需借用請重新提出申請。</span>
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <Button
                type="button"
                onClick={() => setModal({ type: "loan", loan: selectedLoan })}
              >
                返回詳情
              </Button>
              {modal.action === "approve" && (
                <Button
                  type="button"
                  className="danger-outline"
                  onClick={() =>
                    setModal({
                      type: "decision",
                      loan: selectedLoan,
                      action: "reject",
                    })
                  }
                >
                  改為駁回
                </Button>
              )}
              <Button
                className={
                  ["cancel", "reject"].includes(modal.action)
                    ? "danger"
                    : "primary"
                }
                disabled={busy}
              >
                {busy ? <span className="spinner" /> : <Check size={16} />}確認
                {
                  (
                    {
                      approve: "核准",
                      reject: "駁回",
                      checkout: "領用",
                      return: "歸還",
                      cancel: "取消",
                    } as Record<string, string>
                  )[modal.action]
                }
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {modal?.type === "user" && isAdmin && (
        <Dialog
          title={modal.user ? "編輯成員與權限" : "新增團隊成員"}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) =>
              submit(e, (b) =>
                mutate(
                  "users" + (modal.user ? "/" + modal.user.id : ""),
                  modal.user ? "PUT" : "POST",
                  { ...b, ...(modal.user ? { active: Number(b.active) } : {}) },
                  modal.user
                    ? "成員資料與權限已更新"
                    : "新成員已建立，首次登入須修改密碼",
                ),
              )
            }
          >
            <div className="dialog-body">
              {formAlert}
              <div className="form-grid">
                <Field label="姓名">
                  <input
                    name="name"
                    defaultValue={modal.user?.name}
                    required
                    maxLength={60}
                  />
                </Field>
                <Field label="登入帳號">
                  <input
                    name="username"
                    defaultValue={modal.user?.username}
                    readOnly={!!modal.user}
                    required
                    minLength={3}
                    maxLength={40}
                    pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}"
                    autoComplete="off"
                  />
                </Field>
                <Field label="所屬部門">
                  <input
                    name="department"
                    defaultValue={modal.user?.department}
                    required
                    maxLength={60}
                    list="departments"
                  />
                  <datalist id="departments">
                    {[...new Set(data.users.map((x) => x.department))].map(
                      (d) => (
                        <option key={d}>{d}</option>
                      ),
                    )}
                  </datalist>
                </Field>
                <Field label="權限角色">
                  <select
                    name="role"
                    defaultValue={modal.user?.role || "employee"}
                  >
                    {Object.entries(roles).map(([r, n]) => (
                      <option value={r} key={r}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="聯絡電子郵件">
                <input
                  name="email"
                  type="email"
                  defaultValue={modal.user?.email}
                  maxLength={254}
                />
              </Field>
              <Field
                label={modal.user ? "重設臨時密碼（留空不變更）" : "臨時密碼"}
                hint="至少 12 字元，含英文與數字。請安全告知本人；首次登入必須更新。"
              >
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  required={!modal.user}
                  autoComplete="new-password"
                />
              </Field>
              {modal.user && (
                <Field label="帳號狀態">
                  <select name="active" defaultValue={modal.user.active}>
                    <option value={1}>啟用中</option>
                    <option value={0}>停用帳號</option>
                  </select>
                </Field>
              )}
              <div className="notice">
                <ShieldCheck size={17} />
                <span>
                  主管僅可簽核同部門的其他使用者；管理員可跨部門簽核。變更會登出該成員的既有登入。
                </span>
              </div>
            </div>
            <div className="dialog-footer">
              <Button type="button" onClick={() => setModal(null)}>
                取消
              </Button>
              <Button className="primary" disabled={busy}>
                <Check size={16} />
                {modal.user ? "儲存變更" : "建立成員"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
function Period({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <select
      aria-label="借用趨勢期間"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value={30}>近 30 天</option>
      <option value={7}>近 7 天</option>
      <option value={90}>近 90 天</option>
    </select>
  );
}
function Trend({ loans, days }: { loans: Loan[]; days: number }) {
  const end = Date.now(),
    bins = days === 7 ? 7 : days === 30 ? 10 : 12,
    step = days / bins,
    values = Array.from(
      { length: bins },
      (_, i) =>
        loans.filter((l) => {
          const d = Date.parse(l.created);
          return (
            d >= end - (days - i * step) * 86400000 &&
            d < end - (days - (i + 1) * step) * 86400000
          );
        }).length,
    ),
    max = Math.max(2, ...values),
    top = Math.ceil(max / 2) * 2,
    points = values.map((v, i) => [
      42 + (i * 538) / (bins - 1),
      163 - (v / top) * 132,
    ]);
  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 600 205"
        role="img"
        aria-label={`近 ${days} 天借用趨勢，共 ${values.reduce((a, b) => a + b, 0)} 筆申請`}
      >
        <title>依日期統計的設備借用申請數</title>
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <line
              x1="42"
              x2="580"
              y1={163 - p * 132}
              y2={163 - p * 132}
              stroke="var(--rule)"
              strokeDasharray="3 5"
            />
            <text x="24" y={167 - p * 132} textAnchor="end">
              {top * p}
            </text>
          </g>
        ))}
        <polyline
          points={points.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={values[i] > 0 ? 3 : 0}
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <rect x={x - 14} y="20" width="28" height="148" fill="transparent">
              <title>
                {dateLabel(
                  taipeiDate(new Date(end - (days - i * step) * 86400000)),
                )}{" "}
                起：{values[i]} 筆
              </title>
            </rect>
          </g>
        ))}
        {[0, Math.floor((bins - 1) / 2), bins - 1].map((i) => (
          <text
            x={points[i][0]}
            y="195"
            textAnchor={i === 0 ? "start" : i === bins - 1 ? "end" : "middle"}
            key={i}
          >
            {dateLabel(
              taipeiDate(new Date(end - (days - (i + 1) * step) * 86400000)),
            )}
          </text>
        ))}
      </svg>
    </div>
  );
}
function DeviceDrawing({ category }: { category: string }) {
  const Icon = categoryIcon(category);
  return (
    <div className="device-drawing">
      <div className="device-screen">
        <Icon size={36} strokeWidth={1} />
      </div>
      <div className="device-base" />
    </div>
  );
}
function AuthScreen({
  setup,
  onDone,
}: {
  setup: boolean;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <span>為團隊而設計的設備工作空間</span>
          <p className="story-title">
            好的協作，
            <br />
            從有序的借還開始。
          </p>
          <p>
            讓每一台設備，都在需要的人手中。
            <br />
            從提出需求到安心歸還，連結團隊的每一步。
          </p>
          <div className="auth-flow">
            {[
              ["01", "借用申請"],
              ["02", "主管簽核"],
              ["03", "領用點交"],
              ["04", "歸還檢查"],
            ].map(([n, t]) => (
              <div key={n}>
                <span>{n}</span>
                <strong>{t}</strong>
              </div>
            ))}
          </div>
        </div>
        <footer>
          <ShieldCheck size={16} />
          權限分層・簽核追蹤・設備協作
        </footer>
      </section>
      <section className="auth-form-section">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="eyebrow">BFT EQUIPMENT WORKSPACE</span>
          <h1>{setup ? "建立你的設備工作空間" : "歡迎回到工作空間"}</h1>
          <p className="muted">
            {setup
              ? "設定第一位管理員，讓團隊的設備管理就此開始。"
              : "登入帳號，接續團隊的每一次設備協作。"}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const b = Object.fromEntries(new FormData(e.currentTarget));
              if (setup && b.password !== b.confirmPassword) {
                setError("兩次輸入的密碼不一致");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await api(setup ? "setup" : "login", "POST", {
                  ...b,
                  sample: b.sample === "on",
                });
                await onDone();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {error && (
              <div role="alert" className="form-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {setup && (
              <>
                <Field label="工作空間名稱">
                  <input
                    name="organization"
                    defaultValue="BFT 工作空間"
                    required
                    maxLength={60}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="你的姓名">
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={60}
                      placeholder="管理員姓名"
                    />
                  </Field>
                  <Field label="所屬部門">
                    <input
                      name="department"
                      defaultValue="行政管理部"
                      required
                      maxLength={60}
                    />
                  </Field>
                </div>
                <Field label="聯絡電子郵件（選填）">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="name@company.com"
                  />
                </Field>
              </>
            )}
            <Field
              label="登入帳號"
              hint={
                setup
                  ? "3–40 字元，可使用英文、數字、點、底線或連字號。"
                  : undefined
              }
            >
              <input
                name="username"
                required
                autoComplete="username"
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}"
                placeholder={setup ? "例如：bft.admin" : "輸入你的帳號"}
              />
            </Field>
            <Field
              label={setup ? "設定密碼" : "密碼"}
              hint={setup ? "至少 12 字元，需包含英文字母與數字。" : undefined}
            >
              <div className="password-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={setup ? 12 : 1}
                  maxLength={128}
                  autoComplete={setup ? "new-password" : "current-password"}
                  placeholder="輸入你的密碼"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "隱藏密碼" : "顯示密碼"}
                  aria-pressed={show}
                >
                  <Eye size={17} />
                </button>
              </div>
            </Field>
            {setup && (
              <>
                <Field label="再次確認密碼">
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </Field>
                <label className="checkbox-label">
                  <input type="checkbox" name="sample" defaultChecked />
                  <span>
                    載入範例設備與借還資料
                    <small>12 台設備、11 筆借還紀錄；範例成員預設停用。</small>
                  </span>
                </label>
              </>
            )}
            <Button className="primary auth-submit" disabled={busy}>
              {busy && <span className="spinner" />}
              {setup ? "建立工作空間" : "登入工作空間"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-help">
            <LockKeyhole size={14} />
            {setup
              ? "管理員密碼由你自行設定，系統沒有預設密碼。"
              : "如忘記密碼，請聯繫系統管理員重設臨時密碼。"}
          </p>
        </div>
        <span className="auth-copyright">
          © {new Date().getFullYear()} BFT · 每一次借還，都值得被好好管理。
        </span>
      </section>
    </main>
  );
}

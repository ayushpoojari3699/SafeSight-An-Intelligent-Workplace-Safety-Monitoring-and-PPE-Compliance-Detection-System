import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  ShieldCheck,
  LayoutDashboard,
  Bot,
  UploadCloud,
  FileText,
  ClipboardList,
  BarChart3,
  Users,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

const WORKSPACE_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
];

const ADMIN_ITEMS = [
  { to: "/admin/upload", label: "Upload Center", icon: UploadCloud },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/detections", label: "Detections", icon: ClipboardList },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/sites", label: "Sites", icon: MapPin },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AppBackgroundGlow() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Flat, near-white surface — no soft color-blob mesh. Large blurred
          overlapping orbs (what this background used before) inherently
          read as an abstract painting; real B2B dashboards (Linear,
          Vercel, Stripe) are close to flat, and let borders and typography
          do the work instead of a decorative backdrop. */}
      <div className="absolute inset-0 bg-[#f4f6fb]" />

      {/* Barely-there depth: a single, very low-contrast top-to-bottom
          shift (a couple percent, not a visible gradient) so the page
          isn't a dead flat fill. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white to-[#eef1f7]" />

      {/* One crisp, thin accent line under the topbar — a hairline, not a
          glow — which is the actual visual language enterprise dashboards
          use for "branded but restrained". */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-red-500/[0.04] to-transparent" />

      {/* Fine grain so the flat surface still has a tactile, material
          quality rather than looking like a plain digital fill. Lighter
          than it was on the dark theme — the same amount of noise reads as
          dirt on a white page. */}
      <div
        className="absolute inset-0 opacity-[0.015] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return "";
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const initialLoad = useRef(true);

  const load = () => {
    if (initialLoad.current) setLoading(true);
    axios
      .get(`${API_BASE}/notifications`)
      .then((res) => {
        setItems(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        initialLoad.current = false;
      });
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const acknowledge = async (id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await axios.post(`${API_BASE}/notifications/${id}/ack`);
    } catch {
      // Best-effort — a stray unread notification isn't worth a retry loop.
    }
  };

  const acknowledgeAll = async () => {
    setItems([]);
    setUnreadCount(0);
    try {
      await axios.post(`${API_BASE}/notifications/read-all`);
    } catch {
      load();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-[#111827] border border-gray-800 rounded-xl shadow-xl overflow-hidden z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="text-base font-medium">Violation Alerts</div>
              {items.length > 0 && (
                <button
                  onClick={acknowledgeAll}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">Loading...</div>
              ) : items.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  No unread violations. You're all caught up.
                </div>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-gray-800/60 last:border-b-0 hover:bg-white/5 transition"
                  >
                    <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200">
                        {n.unsafe_workers} violation{n.unsafe_workers === 1 ? "" : "s"} flagged
                        {n.sites?.length ? ` at ${n.sites.join(", ")}` : ""}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {n.compliance}% compliance &middot; {timeAgo(n.timestamp)}
                      </div>
                    </div>
                    <button
                      onClick={() => acknowledge(n.id)}
                      className="text-xs text-gray-500 hover:text-white shrink-0"
                      title="Mark as read"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function pageTitle(pathname) {
  const map = {
    "/": "Dashboard",
    "/assistant": "AI Assistant",
    "/admin/upload": "Upload Center",
    "/admin/documents": "Manage Documents",
    "/admin/detections": "Manage Detections",
    "/admin/analytics": "Analytics",
    "/admin/users": "User Management",
    "/admin/settings": "Settings",
  };
  return map[pathname] || "Safesight";
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-lg font-medium transition ${
          isActive
            ? "bg-red-500/15 text-red-400 border border-red-500/30"
            : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
        }`
      }
    >
      <Icon size={18} />
      {item.label}
    </NavLink>
  );
}

function SidebarContent({ role, onNavigate }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="bg-red-500/15 text-red-400 rounded-lg p-2">
          <ShieldCheck size={22} />
        </div>
        <div>
          <div className="text-white font-bold leading-tight">Safesight</div>
          <div className="text-xs text-gray-500 leading-tight">
            Safety Intelligence Platform
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
        <div>
          <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Workspace
          </div>
          <div className="space-y-1">
            {WORKSPACE_ITEMS.map((item) => (
              <NavItem key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>

        {role === "admin" && (
          <div>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Administration
            </div>
            <div className="space-y-1">
              {ADMIN_ITEMS.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        Safesight v2.0 &middot; Enterprise
      </div>
    </div>
  );
}

function AppShell() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white flex">
      <AppBackgroundGlow />

      {/* Desktop sidebar */}
      <aside className="relative z-10 hidden lg:flex lg:flex-col w-[260px] shrink-0 bg-[#0b1120] border-r border-gray-800">
        <SidebarContent role={role} onNavigate={() => {}} />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-[#0b1120] border-r border-gray-800">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <SidebarContent role={role} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 shrink-0 border-b border-gray-800 bg-[#0b1120]/80 backdrop-blur flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-400 hover:text-white"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <h1 className="text-xl font-semibold">{pageTitle(location.pathname)}</h1>
          </div>

          <div className="flex items-center gap-2">
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full hover:bg-white/5 transition"
            >
              <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-semibold text-base uppercase">
                {user?.username?.[0] || "?"}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-base font-medium leading-tight">{user?.username}</div>
                <div className="text-xs text-gray-500 leading-tight capitalize">{role}</div>
              </div>
              <ChevronDown size={16} className="text-gray-500" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[#111827] border border-gray-800 rounded-xl shadow-xl overflow-hidden z-20">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <div className="text-base font-medium">{user?.username}</div>
                    <div className="text-sm text-gray-500 capitalize">{role} account</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-base text-red-400 hover:bg-red-500/10 transition"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;

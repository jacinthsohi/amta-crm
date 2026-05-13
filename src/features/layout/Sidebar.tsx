import { useState, useEffect } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import {
  Home,
  Users,
  GraduationCap,
  Briefcase,
  Calendar,
  FolderKanban,
  MessageSquare,
  CheckSquare,
  Search,
  Sparkles,
  LogOut,
  Shield,
  Mail,
  UserPlus,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/features/admin/hooks";
import { usePendingClaimsCount } from "@/features/admin/alumni-claims-hooks";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";

// =============================================================================
// Sidebar collapsed-state persistence
// =============================================================================
// Stored in localStorage so the user's preference survives reloads. Read once
// at mount; writes happen via the toggle.
const SIDEBAR_COLLAPSED_KEY = "amta:sidebar-collapsed";

function readCollapsedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsedToStorage(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // ignore — Safari private mode etc.
  }
}

// =============================================================================
// Width constants
// =============================================================================
const SIDEBAR_WIDTH_EXPANDED = 232;
const SIDEBAR_WIDTH_COLLAPSED = 56;

// =============================================================================
// Nav items
// =============================================================================
const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/ask", label: "Ask AI", icon: Sparkles },
  { to: "/data", label: "Data", icon: BarChart3 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/programs", label: "Programs", icon: GraduationCap },
  { to: "/committees", label: "Committees", icon: Briefcase },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/interactions", label: "Interactions", icon: MessageSquare },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
];

export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const { contact, user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: pendingClaimsCount } = usePendingClaimsCount();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readCollapsedFromStorage(),
  );

  // Keep storage in sync any time the toggle flips.
  useEffect(() => {
    writeCollapsedToStorage(collapsed);
  }, [collapsed]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  function toggleCollapsed() {
    setCollapsed((prev) => !prev);
  }

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 shrink-0 border-r border-zinc-200 bg-zinc-50 transition-[width] duration-150"
      style={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
      }}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "pt-5 pb-4 flex items-center",
          collapsed ? "justify-center px-2" : "px-4 gap-2.5",
        )}
      >
        {collapsed ? (
          // Collapsed: just the toggle button, centered. Logo would be redundant
          // next to a single-icon column.
          <button
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="p-1.5 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <PanelLeftOpen size={16} />
          </button>
        ) : (
          <>
            <img src="/amta-logo.png" alt="AMTA" className="w-7 h-7" />
            <div className="flex flex-col leading-tight flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-zinc-900">
                AMTA
              </span>
              <span className="text-[10.5px] text-zinc-500 tracking-wide">
                Internal CRM
              </span>
            </div>
            <button
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <PanelLeftClose size={15} />
            </button>
          </>
        )}
      </div>

      {/* Search trigger — full input expanded, icon button collapsed */}
      <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
        {collapsed ? (
          <button
            onClick={onSearch}
            title="Search (⌘K)"
            className="w-full flex items-center justify-center p-2 rounded-md bg-white border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 transition-colors"
          >
            <Search size={14} />
          </button>
        ) : (
          <button
            onClick={onSearch}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs bg-white border border-zinc-200 text-zinc-400 hover:border-zinc-300 transition-colors"
          >
            <Search size={13} />
            <span>Search…</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
              ⌘K
            </span>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto", collapsed ? "px-1.5" : "px-2")}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors mb-0.5",
                collapsed
                  ? "justify-center p-2"
                  : "gap-2.5 px-2.5 py-1.5",
                active
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )}
            >
              <Icon size={15} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Admin section — only visible to admins */}
      {isAdmin && (
        <div
          className={cn(
            "pb-2 border-t border-zinc-200 pt-2",
            collapsed ? "px-1.5" : "px-2",
          )}
        >
          {!collapsed && (
            <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Admin
            </div>
          )}
          <NavLink
            to="/admin/invitations"
            title={collapsed ? "Invitations" : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md text-sm transition-colors mb-0.5",
                collapsed
                  ? "justify-center p-2"
                  : "gap-2.5 px-2.5 py-1.5",
                isActive
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )
            }
          >
            <Mail size={15} />
            {!collapsed && <span>Invitations</span>}
          </NavLink>
          <NavLink
            to="/admin/alumni-claims"
            title={
              collapsed
                ? pendingClaimsCount && pendingClaimsCount > 0
                  ? `Alumni claims (${pendingClaimsCount} pending)`
                  : "Alumni claims"
                : undefined
            }
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md text-sm transition-colors mb-0.5 relative",
                collapsed
                  ? "justify-center p-2"
                  : "gap-2.5 px-2.5 py-1.5",
                isActive
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )
            }
          >
            <UserPlus size={15} />
            {!collapsed && <span>Alumni claims</span>}
            {/*
              Expanded: pill on the right. Collapsed: small dot on the
              icon's top-right corner. Either way, the count signal is
              visible to admins.
            */}
            {pendingClaimsCount && pendingClaimsCount > 0 ? (
              collapsed ? (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-maroon-600" />
              ) : (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-maroon-600 px-1.5 text-[10px] font-medium text-white min-w-[18px] h-[18px]">
                  {pendingClaimsCount}
                </span>
              )
            ) : null}
          </NavLink>
          <NavLink
            to="/admin/access"
            title={collapsed ? "Access" : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md text-sm transition-colors mb-0.5",
                collapsed
                  ? "justify-center p-2"
                  : "gap-2.5 px-2.5 py-1.5",
                isActive
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )
            }
          >
            <Shield size={15} />
            {!collapsed && <span>Access</span>}
          </NavLink>
        </div>
      )}

      {/* Profile */}
      <div
        className={cn(
          "py-3 border-t border-zinc-200",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <div
              title={
                contact
                  ? `${contact.first_name} ${contact.last_name}`
                  : user?.email
              }
              className="flex items-center justify-center rounded-full text-[11px] font-medium bg-maroon-50 text-maroon-700 border border-maroon-100 shrink-0 w-7 h-7"
            >
              {contact ? initialsOf(contact) : "?"}
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1 rounded hover:bg-zinc-100 text-zinc-500"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-full text-[11px] font-medium bg-maroon-50 text-maroon-700 border border-maroon-100 shrink-0 w-7 h-7">
              {contact ? initialsOf(contact) : "?"}
            </div>
            <div className="flex flex-col leading-tight flex-1 min-w-0">
              <span className="text-xs font-medium text-zinc-800 truncate">
                {contact
                  ? `${contact.first_name} ${contact.last_name}`
                  : user?.email}
              </span>
              <span className="text-[10.5px] text-zinc-500 truncate">
                {contact?.email ?? user?.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1 rounded hover:bg-zinc-100 text-zinc-500"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

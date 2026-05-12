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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/features/admin/hooks";
import { usePendingClaimsCount } from "@/features/admin/alumni-claims-hooks";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/ask", label: "Ask AI", icon: Sparkles },
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 shrink-0 border-r border-zinc-200 bg-zinc-50"
      style={{ width: 232 }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <img
          src="/amta-logo.png"
          alt="AMTA"
          className="w-7 h-7"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-zinc-900">AMTA</span>
          <span className="text-[10.5px] text-zinc-500 tracking-wide">
            Internal CRM
          </span>
        </div>
      </div>

      {/* Search trigger */}
      <div className="px-3 pb-3">
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
      </div>

      {/* Nav */}
      <nav className="px-2 flex-1 overflow-y-auto">
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
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors mb-0.5",
                active
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Admin section — only visible to admins */}
      {isAdmin && (
        <div className="px-2 pb-2 border-t border-zinc-200 pt-2">
          <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Admin
          </div>
          <NavLink
            to="/admin/invitations"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors mb-0.5",
                isActive
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )
            }
          >
            <Mail size={15} />
            <span>Invitations</span>
          </NavLink>
          <NavLink
            to="/admin/alumni-claims"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors mb-0.5",
                isActive
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )
            }
          >
            <UserPlus size={15} />
            <span>Alumni claims</span>
            {pendingClaimsCount && pendingClaimsCount > 0 ? (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-maroon-600 px-1.5 text-[10px] font-medium text-white min-w-[18px] h-[18px]">
                {pendingClaimsCount}
              </span>
            ) : null}
          </NavLink>
          <NavLink
            to="/admin/access"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors mb-0.5",
                isActive
                  ? "bg-maroon-50 text-maroon-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )
            }
          >
            <Shield size={15} />
            <span>Access</span>
          </NavLink>
        </div>
      )}

      {/* Profile */}
      <div className="px-3 py-3 border-t border-zinc-200">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-full text-[11px] font-medium bg-maroon-50 text-maroon-700 border border-maroon-100 shrink-0 w-7 h-7">
            {contact ? initialsOf(contact) : "?"}
          </div>
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            <span className="text-xs font-medium text-zinc-800 truncate">
              {contact ? `${contact.first_name} ${contact.last_name}` : user?.email}
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
      </div>
    </aside>
  );
}

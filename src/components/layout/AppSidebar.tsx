import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Clock,
  FileText,
  Network,
  Scale,
  Users,
  Target,
  Building2,
  ArrowRightLeft,
  SlidersHorizontal,
  Lock,
  TrendingUp,
  Globe,
  Coins,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/liquidity", label: "Liquidity", icon: TrendingUp },
  { to: "/pipeline", label: "Pipeline", icon: Clock },
  { to: "/audit", label: "Audit Log", icon: FileText },
];

const adminNav = [
  { to: "/admin/providers", label: "Providers", icon: Network },
  { to: "/admin/rules", label: "Routing Rules", icon: Scale },
  { to: "/admin/beneficiaries", label: "Beneficiaries", icon: Building2 },
  { to: "/admin/targets", label: "Flow Targets", icon: Target },
  { to: "/admin/weights", label: "Scoring Weights", icon: SlidersHorizontal },
  { to: "/admin/users", label: "Users", icon: Users },
];

export function AppSidebar() {
  const location = useLocation();
  const { role } = useAuthContext();

  const isAdmin = role === "admin";
  const canAccessAdmin = role === "admin" || role === "editor";

  const linkClass = (path: string, disabled?: boolean) => {
    const active = location.pathname === path;
    return `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      disabled
        ? "text-sidebar-foreground/30 cursor-not-allowed"
        : active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    }`;
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-30">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <ArrowRightLeft className="w-5 h-5 text-sidebar-primary" />
        <span className="font-semibold text-sidebar-accent-foreground tracking-tight">
          Capi Router
        </span>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="mb-4">
          {mainNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass(item.to)}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="pt-3 border-t border-sidebar-border">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            Admin
          </p>
          {adminNav.map((item) => {
            const disabled = !canAccessAdmin && item.to !== "/admin/users";
            const isUsersPage = item.to === "/admin/users";
            const disableUsers = isUsersPage && !isAdmin;
            const isDisabled = disabled || disableUsers;

            if (isDisabled) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <span className={linkClass(item.to, true)}>
                      <item.icon className="w-4 h-4" />
                      {item.label}
                      <Lock className="w-3 h-3 ml-auto" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isUsersPage ? "Admin only" : "Editor or Admin role required"}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <NavLink key={item.to} to={item.to} className={linkClass(item.to)}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground/40">
          Capi Payment Router v1.0
        </p>
      </div>
    </aside>
  );
}

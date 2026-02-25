import { RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/contexts/AuthContext";

export function TopBar() {
  const { user, role, signOut } = useAuthContext();

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-topbar border-b border-topbar-border flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-topbar-foreground">{today}</span>
        <span className="text-xs text-muted-foreground">
          Balances last updated: —
        </span>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {role && (
          <Badge variant="outline" className="text-xs font-mono">
            {role}
          </Badge>
        )}
        <span className="text-sm text-topbar-foreground">
          {user?.user_metadata?.full_name || user?.email || "User"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </Button>
      </div>
    </header>
  );
}

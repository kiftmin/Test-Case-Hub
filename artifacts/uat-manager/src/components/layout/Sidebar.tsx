import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, PlaySquare, Settings, LogOut, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthUser } from "@/lib/auth";

export function Sidebar() {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Projects", href: "/projects", icon: FolderKanban },
    { name: "Users", href: "/users", icon: UserPlus },
    { name: "Tester Portal", href: "/tester", icon: PlaySquare },
  ];

  const user = getAuthUser();

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2 text-sidebar-foreground font-semibold text-lg tracking-tight">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          TestFlow
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground/70 rounded-md">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground uppercase text-xs">
            {user?.name?.substring(0, 2) || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sidebar-foreground">{user?.name || "User"}</p>
            <p className="truncate text-[10px] text-sidebar-foreground/50">{user?.role || "Tester"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
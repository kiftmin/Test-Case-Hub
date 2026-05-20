import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, PlaySquare, UserPlus, Bug, AlertTriangle, Users, ChevronDown, ChevronRight, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthUser } from "@/lib/auth";
import { roleBadgeClass, roleLabel } from "@/lib/role-utils";

export function Sidebar() {
  const [location] = useLocation();
  const user = getAuthUser();

  const projectMatch = location.match(/\/projects\/(\d+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  // Determine project role for current user via the URL context
  // We don't have assignments here, so use global role as proxy
  const isAdmin = user?.role === "ADMIN";

  // Auto-expand Projects submenu when on a project page
  const [projectsOpen, setProjectsOpen] = useState(!!projectId);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

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
          {/* Dashboard */}
          <Link
            href="/"
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
            Dashboard
          </Link>

          {/* Projects — collapsible group */}
          <div>
            <button
              onClick={() => setProjectsOpen(!projectsOpen)}
              className={cn(
                "w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive("/projects")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <FolderKanban className="h-5 w-5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
              <span className="flex-1 text-left">Projects</span>
              {projectsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {projectsOpen && (
              <div className="ml-4 mt-1 space-y-1 pl-3 border-l border-sidebar-border">
                <Link
                  href="/projects"
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    location === "/projects"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  All Projects
                </Link>
                {projectId && (
                  <>
                    <Link
                      href={`/projects/${projectId}`}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        location === `/projects/${projectId}`
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <FolderKanban className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                      Project Detail
                    </Link>
                    <Link
                      href={`/projects/${projectId}/test-runs`}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        location.includes("/test-runs")
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <CalendarClock className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                      Test Runs
                    </Link>
                    <Link
                      href={`/projects/${projectId}/bugs`}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        location.includes("/bugs")
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Bug className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                      Bugs
                    </Link>
                    {(isAdmin) && (
                      <Link
                        href={`/projects/${projectId}/users`}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          location.includes("/users")
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Users className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                        Manage Users
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Global Users link (Admin only) */}
          {isAdmin && (
            <Link
              href="/users"
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive("/users")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <UserPlus className="h-5 w-5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
              User Management
            </Link>
          )}

          {/* Tester Portal */}
          <Link
            href="/tester"
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/tester")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <PlaySquare className="h-5 w-5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
            Tester Portal
          </Link>
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground/70 rounded-md">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground uppercase text-xs">
            {user?.name?.substring(0, 2) || "U"}
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <p className="truncate text-sidebar-foreground">{user?.name || "User"}</p>
            {user?.role && (
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${roleBadgeClass(user.role)}`}>
                {roleLabel(user.role)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { ReactNode, useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  hideDesktopSidebar?: boolean;
}

export function AppLayout({ children, hideDesktopSidebar }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectionBanner, setConnectionBanner] = useState<"offline" | "restored" | null>(null);

  useEffect(() => {
    const handleOffline = () => setConnectionBanner("offline");
    const handleOnline = () => {
      setConnectionBanner("restored");
      setTimeout(() => setConnectionBanner(null), 3000);
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (!navigator.onLine) setConnectionBanner("offline");
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile hamburger */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-3 left-3 z-40 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden shrink-0",
        hideDesktopSidebar ? "xl:flex" : "lg:flex"
      )}>
        <Sidebar />
      </aside>

      <main className="flex-1 overflow-y-auto focus:outline-none">
        {connectionBanner === "offline" && (
          <div className="sticky top-0 z-50 bg-destructive text-destructive-foreground text-xs font-medium text-center py-2 px-4">
            No connection — your inputs are being saved as drafts locally.
          </div>
        )}
        {connectionBanner === "restored" && (
          <div className="sticky top-0 z-50 bg-green-600 text-white text-xs font-medium text-center py-2 px-4 animate-in slide-in-from-top">
            Connection restored.
          </div>
        )}
        <div className="py-6 sm:py-8 px-6 sm:px-8 max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
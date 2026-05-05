import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto focus:outline-none">
        <div className="py-6 sm:py-8 px-6 sm:px-8 max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
import { useListUserProjects } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthUser, clearAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { LayoutGrid, ClipboardCheck, ArrowRight, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function TesterDashboard() {
  const [, setLocation] = useLocation();
  const user = getAuthUser();
  const [searchQuery, setSearchQuery] = useState("");

  if (!user) {
    setLocation("/tester");
    return null;
  }

  const { data: projects, isLoading } = useListUserProjects(user.id);

  const handleLogout = () => {
    clearAuth();
    setLocation("/tester");
  };

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.projectCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout hideSidebar>
      <PageHeader 
        title={`Welcome back, ${user.name}`} 
        description="Select a project assigned to you to begin or resume testing."
        actions={
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        }
      />

      <div className="mb-8 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search assigned projects..." 
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-32 bg-muted/20"></CardHeader>
              <CardContent className="h-20"></CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects?.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
          <LayoutGrid className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery ? "No projects match your search." : "You haven't been assigned to any projects yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects?.map(project => (
            <Link key={project.id} href={`/tester/${project.projectCode}`}>
              <Card className="group hover:border-primary/50 transition-all cursor-pointer hover:shadow-md border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {project.projectCode}
                    </span>
                    <span className="text-xs text-muted-foreground">v{project.version}.0</span>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">{project.name}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">
                    {project.moduleName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <ClipboardCheck className="w-4 h-4 mr-1.5" />
                      <span>Ready for testing</span>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

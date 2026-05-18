import { useState } from "react";
import { Link } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import { getAuthUser } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, GitMerge, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export default function ProjectsList() {
  const [search, setSearch] = useState("");
  const { data: projects, isLoading } = useListProjects();
  const user = getAuthUser();
  const isAdmin = user?.role === "ADMIN";

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.projectCode.toLowerCase().includes(search.toLowerCase()) ||
    p.moduleName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <PageHeader 
        title="Projects" 
        description="Manage your UAT projects and test suites."
        actions={isAdmin && (
          <Link href="/projects/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        )}
      />

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name, code, or module..." 
          className="pl-9 max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-lg" />
              <CardContent className="h-32 bg-muted/20" />
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed border-border bg-card/50">
          <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-muted-foreground mt-1 mb-4">Get started by creating your first test project.</p>
          {isAdmin && (
            <Link href="/projects/new">
              <Button variant="outline">Create Project</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map(project => (
            <Card key={project.id} className="flex flex-col hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg leading-tight line-clamp-1">
                      <Link href={`/projects/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {project.projectCode}
                      </Badge>
                      {(project as any).isSignedOff === 1 && (
                        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-[10px] font-bold uppercase py-0 px-1.5 h-4">
                          Signed Off
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {project.moduleName}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1.5">
                    <div className="flex items-center text-muted-foreground">
                      <GitMerge className="w-3.5 h-3.5 mr-1.5" />
                      Version
                    </div>
                    <p className="font-medium">v{project.version}.0</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      Updated
                    </div>
                    <p className="font-medium truncate">
                      {format(new Date(project.updatedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t bg-muted/20 pt-4 flex gap-2">
                <Link href={`/projects/${project.id}`} className="flex-1">
                  <Button variant="secondary" className="w-full text-xs" size="sm">
                    Test Cases
                  </Button>
                </Link>
                <Link href={`/projects/${project.id}/stats`} className="flex-1">
                  <Button variant="outline" className="w-full text-xs" size="sm">
                    Analytics
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

import { FolderKanban } from "lucide-react";
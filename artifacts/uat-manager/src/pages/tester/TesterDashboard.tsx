import { useListUserProjects, useGetTesterTestRuns, getGetTesterTestRunsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthUser, clearAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { LayoutGrid, ClipboardCheck, ArrowRight, LogOut, Search, Clock, CalendarClock, PlayCircle, List, Columns3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

function Countdown({ targetDate, onComplete }: { targetDate: string, onComplete?: () => void }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTimeLeft(diff);
      if (diff === 0 && onComplete) onComplete();
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate, onComplete]);

  if (timeLeft === 0) return null;

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="flex items-center gap-1 font-mono text-amber-600 animate-pulse">
      <Clock className="w-4 h-4" />
      <span>{hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
}

export default function TesterDashboard() {
  const [, setLocation] = useLocation();
  const user = getAuthUser()!;
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: projects, isLoading: isLoadingProjects } = useListUserProjects(user.id);
  const { data: testRuns, isLoading: isLoadingRuns, refetch: refetchRuns } = useGetTesterTestRuns(user.id, {
    query: { refetchInterval: 30000, queryKey: getGetTesterTestRunsQueryKey(user.id) }
  });

  const sortedRuns = testRuns
    ? [...testRuns].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    : [];

  const handleLogout = () => {
    clearAuth();
    setLocation("/tester");
  };

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.projectCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = isLoadingProjects || isLoadingRuns;

  if (user && !user.id) {
    return (
    <AppLayout hideDesktopSidebar>
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-bold text-red-600">Session Error</h2>
          <p className="text-red-500">Your session is missing a User ID. Please sign out and sign in again.</p>
          <Button onClick={handleLogout} className="mt-4">Sign Out</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader 
        title={`Welcome back, ${user.name}`} 
        description="VERIFIED: Select a project or a scheduled test run to begin testing."
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

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Assigned Test Runs</h2>
          </div>
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("grid")}
            >
              <Columns3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoadingRuns ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="animate-pulse h-40 bg-muted/20" />
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse bg-muted/20 rounded-md" />)}
            </div>
          )
        ) : !testRuns || testRuns.length === 0 ? (
          <div className="text-center py-10 bg-muted/10 rounded-xl border border-dashed border-border">
            <p className="text-muted-foreground italic">No test runs currently assigned to you.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedRuns.map((run) => {
              return (
              <Card key={run.id} className={cn(
                "relative overflow-hidden border-border transition-all",
                run.isAvailable && run.status === "scheduled" ? "hover:border-primary/50 hover:shadow-md cursor-pointer" : "opacity-80"
              )}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {run.status === "scheduled" && run.isAvailable && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                          Available Now
                        </Badge>
                      )}
                      {(() => {
                        if (run.status === "completed") {
                          return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">COMPLETED</Badge>;
                        } else if (run.myPendingCount === run.myUseCaseCount) {
                          return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">NEW</Badge>;
                        } else {
                          return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">IN PROGRESS</Badge>;
                        }
                      })()}
                    </div>
                    {run.status === "scheduled" && !run.isAvailable && <Countdown targetDate={run.scheduledAt} onComplete={refetchRuns} />}
                  </div>
                  <CardTitle className="text-base line-clamp-1">{run.name}</CardTitle>
                  <CardDescription className="text-xs">
                    Scheduled: {new Date(run.scheduledAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{run.myUseCaseCount} use cases assigned</span>
                    {run.status === "completed" ? (
                      <Link href={`/tester/run/${run.id}`}>
                        <Button size="sm" variant="secondary" className="h-8">
                          <ClipboardCheck className="w-4 h-4 mr-1.5" />
                          View
                        </Button>
                      </Link>
                    ) : run.isAvailable ? (
                      <Link href={`/tester/run/${run.id}`}>
                        <Button size="sm" className="h-8">
                          <PlayCircle className="w-4 h-4 mr-1.5" />
                          Start
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="secondary" disabled className="h-8">
                        <Clock className="w-4 h-4 mr-1.5" />
                        Locked
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Project</th>
                  <th className="text-left py-3 px-4 font-medium">Scheduled</th>
                  <th className="text-center py-3 px-4 font-medium">Assigned</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedRuns.map((run) => {
                  const project = projects?.find(p => p.projectCode === run.projectCode);
                  const isSignedOff = (project as any)?.isSignedOff === 1;
                  if (isSignedOff) return null;
                  return (
                    <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{run.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{run.projectCode}</td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(run.scheduledAt).toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">{run.myUseCaseCount}</td>
                      <td className="py-3 px-4 text-center">
                        {(() => {
                          if (run.status === "completed") {
                            return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">COMPLETED</Badge>;
                          } else if (run.myPendingCount === run.myUseCaseCount) {
                            return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">NEW</Badge>;
                          } else {
                            return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">IN PROGRESS</Badge>;
                          }
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {run.status === "completed" ? (
                          <Link href={`/tester/run/${run.id}`}>
                            <Button size="sm" variant="secondary" className="h-8">
                              <ClipboardCheck className="w-4 h-4 mr-1.5" />
                              View
                            </Button>
                          </Link>
                        ) : run.isAvailable ? (
                          <Link href={`/tester/run/${run.id}`}>
                            <Button size="sm" className="h-8">
                              <PlayCircle className="w-4 h-4 mr-1.5" />
                              Start
                            </Button>
                          </Link>
                        ) : (
                          <Button size="sm" variant="secondary" disabled className="h-8">
                            <Clock className="w-4 h-4 mr-1.5" />
                            Locked
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 mb-4">
        <LayoutGrid className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Assigned Projects</h2>
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
          {filteredProjects?.map(project => {
            const isSignedOff = (project as any).isSignedOff === 1;
            return (
              <div key={project.id}>
                {isSignedOff ? (
                  <Card className="border-border bg-card/50 opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {project.projectCode}
                        </span>
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] font-bold uppercase">Signed Off</Badge>
                      </div>
                      <CardTitle className="text-muted-foreground">{project.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        Access Restricted: Project is signed off.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Testing phase complete
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Link href={`/tester/${project.projectCode}`}>
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

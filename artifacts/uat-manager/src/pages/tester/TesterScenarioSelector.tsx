import { useParams, useLocation, Link } from "wouter";
import { useGetTestRun, getGetTestRunQueryKey, useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthUser, clearAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, LogOut, ClipboardCheck, Check, AlertCircle, PlayCircle, ArrowRight, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TesterScenarioSelector() {
  const { testRunId } = useParams();
  const [, setLocation] = useLocation();
  const trId = parseInt(testRunId || "0", 10);
  const user = getAuthUser();
  const queryClient = useQueryClient();

  const { data: testRun, isLoading: isLoadingRun } = useGetTestRun(trId, {
    query: { enabled: !!trId, queryKey: getGetTestRunQueryKey(trId) },
  });

  const projectId = testRun?.projectId ?? 0;
  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const isLoading = isLoadingRun || isLoadingProject;

  const handleLogout = () => {
    clearAuth();
    setLocation("/tester");
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading test scenarios...</p>
        </div>
      </div>
    );
  }

  if (!testRun || !project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-bold">Test Run Not Found</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">
          This test run could not be found or you don't have access to it.
        </p>
        <Link href="/tester/dashboard">
          <Button variant="outline" className="mt-6">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (testRun.status === "completed") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <ClipboardCheck className="w-12 h-12 text-green-600 mb-4" />
        <h2 className="text-lg font-bold">Test Run Submitted</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">
          This test run has already been completed and submitted. Thank you for your contribution.
        </p>
        <Link href="/tester/dashboard">
          <Button variant="outline" className="mt-6">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const myRunUseCases = testRun.useCases?.filter(
    (uc: any) => uc.assignedTesterUsername === user.username
  ) ?? [];

  const scenarioCards = myRunUseCases.map((ruc: any) => {
    const projectUc = project.useCases?.find((uc: any) => uc.id === ruc.useCaseId);
    const testCases = projectUc?.testCases ?? [];
    const total = testCases.length;
    const completed = testCases.filter((tc: any) => {
      const exec = tc.executions?.find(
        (e: any) => e.testRunId === trId && e.status !== "in_progress"
      );
      return !!exec;
    }).length;
    const isFullyComplete = total > 0 && completed === total;

    return {
      useCaseId: ruc.useCaseId,
      code: ruc.useCaseCode ?? projectUc?.code ?? "",
      name: ruc.useCaseName ?? projectUc?.name ?? "",
      totalTestCases: total,
      completedTestCases: completed,
      isFullyComplete,
    };
  });

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto w-full">
      <header className="sticky top-0 z-10 bg-card border-b shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/tester/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-sm leading-tight">{project.name}</h1>
              <p className="text-[10px] text-muted-foreground font-mono">{testRun.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Sign out">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Your Scenarios ({scenarioCards.length})
          </h2>
          {testRun.status === "in_progress" && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
              In Progress
            </Badge>
          )}
          {testRun.status === "scheduled" && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">
              Scheduled
            </Badge>
          )}
        </div>

        {scenarioCards.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No scenarios assigned to you in this test run.</p>
          </div>
        ) : (
          scenarioCards.map((scenario: any) => (
            <button
              key={scenario.useCaseId}
              onClick={() => setLocation(`/tester/run/${trId}/scenario/${scenario.useCaseId}`)}
              className="w-full text-left"
            >
              <Card
                className={cn(
                  "border-border transition-all hover:border-primary/50 hover:shadow-md",
                  scenario.isFullyComplete && "border-green-200 bg-green-50/30"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
                          {scenario.code}
                        </span>
                        {scenario.isFullyComplete && (
                          <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[10px] h-5 px-1.5">
                            <Check className="w-3 h-3 mr-0.5" /> Done
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2">{scenario.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 max-w-[120px]">
                          <Progress
                            value={scenario.total > 0 ? (scenario.completed / scenario.total) * 100 : 0}
                            className={cn(
                              "h-1.5",
                              scenario.isFullyComplete ? "bg-green-100" : "bg-muted"
                            )}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {scenario.completed} / {scenario.total} cases
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      {scenario.isFullyComplete ? (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

import { useParams, useLocation, Link } from "wouter";
import { useGetTestRun, getGetTestRunQueryKey, useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { getAuthUser, clearAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, LogOut, Check, X, PlayCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TesterCaseSelector() {
  const { testRunId, scenarioId } = useParams();
  const [, setLocation] = useLocation();
  const trId = parseInt(testRunId || "0", 10);
  const ucid = parseInt(scenarioId || "0", 10);
  const user = getAuthUser();

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
          <p className="text-sm text-muted-foreground">Loading test cases...</p>
        </div>
      </div>
    );
  }

  if (!testRun || !project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-bold">Data Not Found</h2>
        <Link href={`/tester/run/${trId}`}>
          <Button variant="outline" className="mt-6">Back to Scenarios</Button>
        </Link>
      </div>
    );
  }

  const projectUc = project.useCases?.find((uc: any) => uc.id === ucid);

  if (!projectUc) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-bold">Scenario Not Found</h2>
        <Link href={`/tester/run/${trId}`}>
          <Button variant="outline" className="mt-6">Back to Scenarios</Button>
        </Link>
      </div>
    );
  }

  const testCases = projectUc.testCases ?? [];
  const testCaseRows = testCases.map((tc: any) => {
    const exec = tc.executions?.find(
      (e: any) => e.testRunId === trId && e.status !== "in_progress"
    );
    const hasSteps = (tc.steps?.length ?? 0) > 0;
    return {
      id: tc.id,
      caseNumber: tc.caseNumber,
      title: tc.title,
      status: exec
        ? exec.status === "completed" ? "passed" : "failed"
        : "not_started",
      hasSteps,
    };
  });

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto w-full">
      <header className="sticky top-0 z-10 bg-card border-b shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={`/tester/run/${trId}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="truncate">
              <h1 className="font-bold text-sm leading-tight truncate">{projectUc.name}</h1>
              <p className="text-[10px] text-muted-foreground font-mono">{projectUc.code}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Sign out">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Test Cases ({testCaseRows.length})
        </h2>

        {testCaseRows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No test cases in this scenario.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {testCaseRows.map((tcRow: any) => (
              <button
                key={tcRow.id}
                onClick={tcRow.hasSteps ? () => setLocation(`/tester/run/${trId}/scenario/${ucid}/case/${tcRow.id}`) : undefined}
                className={cn("w-full text-left", !tcRow.hasSteps && "cursor-default")}
              >
                <Card
                  className={cn(
                    "border-border transition-all hover:border-primary/50",
                    tcRow.status === "passed" && "border-green-200 bg-green-50/30",
                    tcRow.status === "failed" && "border-red-200 bg-red-50/30",
                    !tcRow.hasSteps && "opacity-50"
                  )}
                >
                  <div className="p-3 flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        tcRow.status === "passed"
                          ? "bg-green-100"
                          : tcRow.status === "failed"
                          ? "bg-red-100"
                          : "bg-muted"
                      )}
                    >
                      {tcRow.status === "passed" ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : tcRow.status === "failed" ? (
                        <X className="w-4 h-4 text-red-600" />
                      ) : (
                        <PlayCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider shrink-0">
                          TC-{tcRow.caseNumber}
                        </span>
                        {!tcRow.hasSteps && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                            No Steps
                          </Badge>
                        )}
                        {tcRow.hasSteps && tcRow.status === "passed" && (
                          <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[10px] h-5 px-1.5">
                            Passed
                          </Badge>
                        )}
                        {tcRow.hasSteps && tcRow.status === "failed" && (
                          <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] h-5 px-1.5">
                            Failed
                          </Badge>
                        )}
                        {tcRow.hasSteps && tcRow.status === "not_started" && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                            Not Started
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-snug mt-0.5 line-clamp-2">{tcRow.title}</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

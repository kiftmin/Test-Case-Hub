import { useState, useEffect } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { 
  useGetProjectByCode, getGetProjectByCodeQueryKey,
  useListExecutions, getListExecutionsQueryKey,
  useCreateExecution, useUpdateExecution, useUpdateStepResult,
  useSyncTestRunUseCaseStatus, useGetTestRun, getGetTestRunQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Check, X, AlertCircle, Save, LogOut, Paperclip, FileIcon, ClipboardCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthUser, clearAuth } from "@/lib/auth";

import { EvidenceUpload } from "@/components/tester/EvidenceUpload";
import { MobileShare } from "@/components/tester/MobileShare";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// A component for executing a single test case
function TestCaseExecutor({ testCase, projectCode, user, testRunId, onComplete }: any) {
  const queryClient = useQueryClient();
  const { data: executions, isLoading: isLoadingExecutions } = useListExecutions(testCase.id, {
    query: { enabled: !!testCase.id, queryKey: getListExecutionsQueryKey(testCase.id) }
  });
  
  const createExecution = useCreateExecution();
  const updateExecution = useUpdateExecution();
  const updateStepResult = useUpdateStepResult();

  const [activeExecutionId, setActiveExecutionId] = useState<number | null>(null);
  const [stepResults, setStepResults] = useState<Record<number, { id?: number; actualResult: string; comments: string; passed: boolean | null; attachments: any[] }>>({});

  // Find the active (in_progress) execution
  const activeExecution = executions?.find(e => e.status === 'in_progress' && e.testerName === user.name);
  const lastCompletedExecution = executions?.find(e => e.status !== 'in_progress');

  // Initialize step results when an execution is active
  useEffect(() => {
    if (activeExecution && activeExecution.id !== activeExecutionId) {
      setActiveExecutionId(activeExecution.id);
      const initialResults: any = {};
      activeExecution.stepResults?.forEach((sr: any) => {
        initialResults[sr.stepId] = {
          id: sr.id,
          actualResult: sr.actualResult || "",
          comments: sr.comments || "",
          passed: sr.passed,
          attachments: sr.attachments || []
        };
      });
      setStepResults(initialResults);
    } else if (!activeExecution) {
      setActiveExecutionId(null);
      setStepResults({});
    }
  }, [activeExecution?.id]);

  const handleStartExecution = async () => {
    const res = await createExecution.mutateAsync({
      testCaseId: testCase.id,
      data: {
        testerName: user.name,
        status: "in_progress",
        testRunId: testRunId || undefined
      }
    });
    queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(testCase.id) });
    setActiveExecutionId(res.id);
  };


  const handleUpdateStep = async (stepId: number, data: any) => {
    if (!activeExecutionId) return;
    
    setStepResults(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...data }
    }));

    await updateStepResult.mutateAsync({
      executionId: activeExecutionId,
      stepId,
      data: {
        actualResult: data.actualResult ?? stepResults[stepId]?.actualResult,
        comments: data.comments ?? stepResults[stepId]?.comments,
        passed: data.passed ?? stepResults[stepId]?.passed,
      }
    });
    
    queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(testCase.id) });
  };

  const syncUseCaseStatus = useSyncTestRunUseCaseStatus();

  const handleCompleteExecution = async (isPass: boolean) => {
    if (!activeExecutionId) return;

    await updateExecution.mutateAsync({
      executionId: activeExecutionId,
      data: {
        testerName: user.name,
        status: isPass ? "completed" : "failed"
      }
    });

    if (testRunId && testCase.useCaseId) {
      try {
        await syncUseCaseStatus.mutateAsync({
          testRunId,
          useCaseId: testCase.useCaseId
        });
      } catch (err) {
        console.error("Failed to sync use case status", err);
      }
    }

    queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(testCase.id) });
    queryClient.invalidateQueries({ queryKey: getGetProjectByCodeQueryKey(projectCode) });
    onComplete();
  };

  if (isLoadingExecutions) return <div className="p-8 text-center animate-pulse">Loading execution history...</div>;

  if (!activeExecutionId) {
    return (
      <Card className="mb-6 border-border shadow-md">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                TC-{testCase.caseNumber}
              </div>
              <CardTitle className="text-xl">{testCase.title}</CardTitle>
            </div>
            {lastCompletedExecution && (
              <div className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border",
                lastCompletedExecution.status === "completed" 
                  ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400" 
                  : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400"
              )}>
                Last: {lastCompletedExecution.status === "completed" ? 'PASSED' : 'FAILED'}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-medium">Ready to start?</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              You will record pass/fail results for each of the {testCase.steps?.length || 0} steps in this test case.
            </p>
          </div>
          <Button onClick={handleStartExecution} className="w-full max-w-xs h-11" disabled={createExecution.isPending}>
            {createExecution.isPending ? "Initializing..." : "Start New Execution"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const allStepsDone = testCase.steps?.every((s: any) => stepResults[s.id]?.passed !== undefined && stepResults[s.id]?.passed !== null);
  const anyStepFailed = testCase.steps?.some((s: any) => stepResults[s.id]?.passed === false);

  return (
    <Card className="mb-6 border-primary/20 shadow-lg overflow-hidden">
      <CardHeader className="bg-primary/5 pb-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              Executing TC-{testCase.caseNumber}
            </div>
            <CardTitle className="text-xl">{testCase.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-1 bg-yellow-100 text-yellow-800 rounded border border-yellow-200 uppercase">
              In Progress
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="divide-y">
          {testCase.steps?.map((step: any) => {
            const result = stepResults[step.id] || { actualResult: "", comments: "", passed: null, attachments: [] };
            return (
              <div key={step.id} className="p-4 md:p-6 space-y-6 hover:bg-muted/5 transition-colors">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                    {step.stepNumber}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Instruction</span>
                      <p className="text-sm font-medium leading-relaxed">{step.instruction}</p>
                      {step.testData && (
                        <div className="mt-2 p-2 bg-muted rounded border border-border flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">Test Data:</span>
                          <code className="text-xs font-mono">{step.testData}</code>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Expected Result</span>
                      <p className="text-sm text-primary/90 font-medium leading-relaxed">{step.expectedResult}</p>
                      
                      {step.attachments?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {step.attachments.map((file: any) => (
                            <a 
                              key={file.id}
                              href={file.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors text-xs font-medium"
                            >
                              <Paperclip className="w-3 h-3" />
                              {file.fileName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-6 pt-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Actual Result</label>
                      <Textarea 
                        placeholder="Describe what happened..." 
                        className="h-20 text-sm resize-none"
                        value={result.actualResult}
                        onChange={(e) => setStepResults(prev => ({ ...prev, [step.id]: { ...result, actualResult: e.target.value } }))}
                        onBlur={(e) => handleUpdateStep(step.id, { actualResult: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Comments / Notes</label>
                      <Textarea 
                        placeholder="Internal notes..." 
                        className="h-20 text-sm resize-none"
                        value={result.comments}
                        onChange={(e) => setStepResults(prev => ({ ...prev, [step.id]: { ...result, comments: e.target.value } }))}
                        onBlur={(e) => handleUpdateStep(step.id, { comments: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Evidence / Screenshots</label>
                      {result.id ? (
                        <EvidenceUpload 
                          entityId={result.id} 
                          entityType="step_result" 
                          attachments={result.attachments}
                          onUpdate={() => queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(testCase.id) })}
                        />
                      ) : (
                        <div className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-md border border-dashed">
                          Mark step status or enter result to enable uploads.
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-2">Step Status</label>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          variant={result.passed === true ? "default" : "outline"}
                          className={cn("flex-1 h-10", result.passed === true && "bg-green-600 hover:bg-green-700")}
                          onClick={() => handleUpdateStep(step.id, { passed: true })}
                        >
                          <Check className="w-4 h-4 mr-2" /> Pass
                        </Button>
                        <Button 
                          size="sm"
                          variant={result.passed === false ? "destructive" : "outline"}
                          className="flex-1 h-10"
                          onClick={() => handleUpdateStep(step.id, { passed: false })}
                        >
                          <X className="w-4 h-4 mr-2" /> Fail
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>


        <div className="p-6 bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4 border-t">
          <div className="text-sm text-muted-foreground">
            {allStepsDone 
              ? <span className="flex items-center text-green-600 font-medium"><Check className="w-4 h-4 mr-2" /> All steps recorded</span>
              : <span>Progress: {Object.values(stepResults).filter(r => r.passed !== null).length} / {testCase.steps?.length} steps completed</span>
            }
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => onComplete()}>
              <Save className="w-4 h-4 mr-2" /> Save & Resume Later
            </Button>
            <Button 
              className={cn("flex-1 sm:flex-none", allStepsDone && !anyStepFailed ? "bg-green-600 hover:bg-green-700" : "")}
              disabled={!allStepsDone || updateExecution.isPending}
              onClick={() => handleCompleteExecution(!anyStepFailed)}
            >
              {anyStepFailed ? "Submit Failure" : "Complete Test"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export default function TestExecutionView() {
  const { projectCode } = useParams();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const testRunIdParam = searchParams.get("testRunId");
  const testRunId = testRunIdParam ? parseInt(testRunIdParam, 10) : undefined;
  
  const code = projectCode?.toUpperCase() || "";
  const user = getAuthUser();

  useEffect(() => {
    if (!user) {
      setLocation("/tester");
    }
  }, [user, setLocation]);

  const { data: project, isLoading: isLoadingProject } = useGetProjectByCode(code, {
    query: { enabled: !!code && !!user, queryKey: getGetProjectByCodeQueryKey(code) }
  });

  const { data: testRun, isLoading: isLoadingTestRun } = useGetTestRun(testRunId!, {
    query: { enabled: !!testRunId, queryKey: getGetTestRunQueryKey(testRunId!) }
  });

  const [activeTestCaseId, setActiveTestCaseId] = useState<number | null>(null);

  if (!user) return null;

  const handleLogout = () => {
    clearAuth();
    setLocation("/tester");
  };

  const isLoading = isLoadingProject || (testRunId && isLoadingTestRun);

  if (isLoading) {
    return <div className="min-h-screen p-8 flex items-center justify-center animate-pulse">Loading Test Plan...</div>;
  }

  if (!project) {
    return <div className="min-h-screen p-8 text-center text-destructive">Project not found or access denied.</div>;
  }

  const isSignedOff = (project as any).isSignedOff === 1;

  if (isSignedOff) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4">
          <ClipboardCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          This project has been officially signed off. The test portal is now closed for this project.
        </p>
        <Link href="/tester/dashboard">
          <Button variant="outline" className="mt-6">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // Filter use cases if a testRunId is provided
  let filteredUseCases = project.useCases;
  if (testRunId && testRun) {
    const assignedUseCaseIds = testRun.useCases
      .filter((uc) => uc.assignedTesterUsername === user.username)
      .map((uc) => uc.useCaseId);
    filteredUseCases = project.useCases.filter((uc) => assignedUseCaseIds.includes(uc.id));
  }

  // Find the active test case object
  let activeTestCase = null;
  if (activeTestCaseId) {
    for (const uc of filteredUseCases) {
      const tc = uc.testCases.find((t: any) => t.id === activeTestCaseId);
      if (tc) {
        activeTestCase = tc;
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-card border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold shadow-sm text-xs">
              {code.slice(0, 2)}
            </div>
            <div>
              <h1 className="font-bold leading-tight">{project.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">v{project.version}.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:flex items-center gap-2 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10">
                  <Smartphone className="w-4 h-4" />
                  Mobile Access
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Mobile Execution</DialogTitle>
                  <DialogDescription>
                    Switch to your mobile device to capture evidence easily.
                  </DialogDescription>
                </DialogHeader>
                <MobileShare />
              </DialogContent>
            </Dialog>

            <span className="text-sm font-medium hidden sm:inline-block bg-muted px-2 py-1 rounded">
              Tester: {user.name}
            </span>
            <Button variant="ghost" size="icon" title="Exit Execution" onClick={handleLogout}>
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
        
        <div className="order-2 lg:order-1">
          {activeTestCase ? (
            <div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mb-4 text-muted-foreground lg:hidden"
                onClick={() => setActiveTestCaseId(null)}
              >
                &larr; Back to list
              </Button>
              <TestCaseExecutor 
                testCase={activeTestCase} 
                projectCode={code} 
                user={user}
                testRunId={testRunId}
                onComplete={() => setActiveTestCaseId(null)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
              <AlertCircle className="w-12 h-12 mb-4 text-muted-foreground/50" />
              <h2 className="text-lg font-semibold text-foreground">Select a Test Case</h2>
              <p className="mt-1 max-w-sm">Choose a test case from the list to view its steps and record your results.</p>
            </div>
          )}
        </div>

        <div className={cn(
          "order-1 lg:order-2 space-y-6 lg:sticky lg:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2",
          activeTestCaseId !== null && "hidden lg:block" // Hide list on mobile when a case is active
        )}>
          {filteredUseCases.map((useCase) => {
            const completedCount = useCase.testCases.filter(tc => tc.executions?.length > 0).length;
            const isFullyCompleted = completedCount === useCase.testCases.length && useCase.testCases.length > 0;
            
            return (
              <div key={useCase.id} className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center justify-between">
                  <span>{useCase.code}: {useCase.name}</span>
                  {isFullyCompleted && <Check className="w-4 h-4 text-green-500" />}
                </h3>
                <div className="space-y-1">
                  {useCase.testCases.map((tc) => {
                    const lastExec = tc.executions?.[0];
                    const isPassed = lastExec?.status === "completed";
                    const isFailed = lastExec?.status === "failed";
                    
                    return (
                      <button
                        key={tc.id}
                        onClick={() => setActiveTestCaseId(tc.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-all border flex items-center justify-between gap-2",
                          activeTestCaseId === tc.id 
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-card hover:border-primary/50 text-foreground",
                          isPassed && activeTestCaseId !== tc.id && "border-green-200 bg-green-50 dark:bg-green-950/20",
                          isFailed && activeTestCaseId !== tc.id && "border-red-200 bg-red-50 dark:bg-red-950/20"
                        )}
                      >
                        <span className="truncate flex-1">
                          <span className="opacity-70 mr-1.5 font-mono text-xs">TC-{tc.caseNumber}</span>
                          {tc.title}
                        </span>
                        {isPassed && <Check className={cn("w-3.5 h-3.5 shrink-0", activeTestCaseId === tc.id ? "text-primary-foreground" : "text-green-600")} />}
                        {isFailed && <X className={cn("w-3.5 h-3.5 shrink-0", activeTestCaseId === tc.id ? "text-primary-foreground" : "text-red-600")} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  );
}
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useGetTestRun, getGetTestRunQueryKey,
  useGetProject, getGetProjectQueryKey,
  useListExecutions, getListExecutionsQueryKey,
  useCreateExecution, useUpdateExecution, useUpdateStepResult,
  useSyncTestRunUseCaseStatus,
  useListDefects, getListDefectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthUser, clearAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Check, X, ChevronLeft, ChevronRight, LogOut, AlertCircle, Loader2, CheckCircle2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceUpload } from "@/components/tester/EvidenceUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TesterStepWizard() {
  const { testRunId, scenarioId, testCaseId } = useParams();
  const [, setLocation] = useLocation();
  const trId = parseInt(testRunId || "0", 10);
  const ucid = parseInt(scenarioId || "0", 10);
  const tcId = parseInt(testCaseId || "0", 10);
  const user = getAuthUser();
  const queryClient = useQueryClient();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepInputs, setStepInputs] = useState<Record<number, { actualResult: string; comments: string; passed: boolean | null }>>({});
  const [activeExecutionId, setActiveExecutionId] = useState<number | null>(null);
  const [showDefectDialog, setShowDefectDialog] = useState(false);
  const [defectNotes, setDefectNotes] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const [stepResultIdByStepId, setStepResultIdByStepId] = useState<Record<number, number>>({});
  const [isSkipping, setIsSkipping] = useState(false);

  const { data: testRun, isLoading: isLoadingRun } = useGetTestRun(trId, {
    query: { enabled: !!trId, queryKey: getGetTestRunQueryKey(trId) },
  });
  const { data: executions, isLoading: isLoadingExecs } = useListExecutions(tcId, {
    query: { enabled: !!tcId, queryKey: getListExecutionsQueryKey(tcId) },
  });

  const projectId = testRun?.projectId ?? 0;
  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const isLoading = isLoadingRun || isLoadingExecs || isLoadingProject;

  const createExecution = useCreateExecution();
  const updateExecution = useUpdateExecution();
  const updateStepResult = useUpdateStepResult();
  const syncUseCaseStatus = useSyncTestRunUseCaseStatus();
  const { data: defects } = useListDefects(trId, {
    query: { enabled: !!trId, queryKey: getListDefectsQueryKey(trId) },
  });

  const activeExecution = executions?.find(
    (e: any) => e.status === "in_progress" && e.testRunId === trId
  );
  const lastCompletedExecution = executions?.find(
    (e: any) => e.status !== "in_progress" && e.testRunId === trId
  );
  const testCaseInTree = project?.useCases?.flatMap((uc: any) => uc.testCases).find((tc: any) => tc.id === tcId);
  const stepDefs = testCaseInTree?.steps ?? [];
  const steps = stepDefs;
  const testCaseData = testCaseInTree;

  useEffect(() => {
    if (activeExecution && activeExecution.id !== activeExecutionId) {
      setActiveExecutionId(activeExecution.id);
      const initial: Record<number, any> = {};
      const srIds: Record<number, number> = {};
      activeExecution.stepResults?.forEach((sr: any) => {
        initial[sr.stepId] = {
          actualResult: sr.actualResult || "",
          comments: sr.comments || "",
          passed: sr.passed,
        };
        srIds[sr.stepId] = sr.id;
        if (sr.comments) {
          setShowComments((prev) => ({ ...prev, [sr.stepId]: true }));
        }
      });
      setStepInputs(initial);
      setStepResultIdByStepId(srIds);
    }
  }, [activeExecution?.id]);

  const casesInScopedUc = project?.useCases?.find((u: any) => u.id === ucid)?.testCases ?? [];
  const nextTcWithSteps = (() => {
    const withSteps = casesInScopedUc.filter((tc: any) => (tc.steps?.length ?? 0) > 0);
    const idx = withSteps.findIndex((tc: any) => tc.id === tcId);
    if (idx >= 0 && idx < withSteps.length - 1) return withSteps[idx + 1];
    return null;
  })();

  useEffect(() => {
    if (!project || isLoading || isSkipping) return;
    if (stepDefs.length > 0) return;
    const hasCompletedExec = executions?.some(
      (e: any) => e.status === "completed" && e.testRunId === trId
    );
    if (hasCompletedExec || !user) {
      setIsSkipping(true);
      return;
    }
    createExecution.mutateAsync({
      testCaseId: tcId,
      data: { testerName: user.name, status: "completed", testRunId: trId || undefined },
    }).then(async () => {
      queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(tcId) });
      try {
        await syncUseCaseStatus.mutateAsync({ testRunId: trId, useCaseId: ucid });
      } catch { /* swallow */ }
    }).finally(() => {
      setIsSkipping(true);
    });
  }, [project, isLoading, stepDefs, executions, user, tcId, trId, isSkipping, syncUseCaseStatus, ucid]);

  useEffect(() => {
    if (!isSkipping || !project) return;
    if (nextTcWithSteps) {
      setLocation(`/tester/run/${trId}/scenario/${ucid}/case/${nextTcWithSteps.id}`);
    } else {
      setLocation(`/tester/run/${trId}/scenario/${ucid}`);
    }
  }, [isSkipping, project, ucid, tcId, trId, nextTcWithSteps]);

  const handleStartExecution = useCallback(async () => {
    if (!tcId || !user) return;
    const res = await createExecution.mutateAsync({
      testCaseId: tcId,
      data: {
        testerName: user.name,
        status: "in_progress",
        testRunId: trId || undefined,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(tcId) });
    setActiveExecutionId(res.id);
  }, [tcId, user, trId, createExecution, queryClient]);

  const handleSaveStep = useCallback(async (stepId: number, data: Partial<{ actualResult: string; comments: string; passed: boolean | null }>) => {
    if (!activeExecutionId) return;
    const merged = { ...stepInputs[stepId], ...data };
    setStepInputs((prev) => ({ ...prev, [stepId]: { ...prev[stepId], ...data } }));
    try {
      const result = await updateStepResult.mutateAsync({
        executionId: activeExecutionId,
        stepId,
        data: {
          actualResult: merged.actualResult,
          comments: merged.comments,
          passed: merged.passed,
        },
      });
      if (result?.id) {
        setStepResultIdByStepId((prev) => ({ ...prev, [stepId]: result.id }));
      }
      queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(tcId) });
    } catch { /* swallow */ }
  }, [activeExecutionId, stepInputs, updateStepResult, queryClient, tcId]);

  const handleCompleteCase = useCallback(async (isPass: boolean) => {
    if (!activeExecutionId) return;
    const data: any = {
      testerName: user!.name,
      status: isPass ? "completed" : "failed",
    };
    if (!isPass) data.notes = defectNotes;
    await updateExecution.mutateAsync({ executionId: activeExecutionId, data });
    if (testRun?.useCases?.[0]?.useCaseId) {
      try {
        await syncUseCaseStatus.mutateAsync({
          testRunId: trId,
          useCaseId: testRun.useCases[0].useCaseId,
        });
      } catch { /* swallow */ }
    }
    queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(tcId) });
    setShowCompletion(false);
    const returnUcId = testRun?.useCases?.[0]?.useCaseId ?? ucid;
    setLocation(`/tester/run/${trId}/scenario/${returnUcId}`);
  }, [activeExecutionId, user, defectNotes, updateExecution, syncUseCaseStatus, trId, tcId, queryClient, setLocation, testRun, ucid]);

  if (!user) return null;

  if (isSkipping) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Skipping test case without steps...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!testRun) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-bold">Test Run Not Found</h2>
        <Link href="/tester/dashboard"><Button variant="outline" className="mt-6">Dashboard</Button></Link>
      </div>
    );
  }

  if (testRun.status === "completed") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
        <h2 className="text-lg font-bold">Test Run Submitted</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">This test run has been completed.</p>
        <Link href={`/tester/run/${trId}`}><Button variant="outline" className="mt-6">Back to Scenarios</Button></Link>
      </div>
    );
  }

  if (lastCompletedExecution && !activeExecution) {
    const stepResults = lastCompletedExecution.stepResults ?? [];
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto w-full">
        <header className="sticky top-0 z-10 bg-card border-b shadow-sm">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link href={`/tester/run/${trId}/scenario/${ucid}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-5 h-5" /></Button>
            </Link>
            <h1 className="font-bold text-sm truncate">{(lastCompletedExecution as any)?.testCase?.title ?? "Test Case"}</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="flex-1 p-4 space-y-3">
          {stepResults.map((sr: any) => {
            const stepDef = stepDefs.find((s: any) => s.id === sr.stepId);
            return (
              <div key={sr.id} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", sr.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                  {sr.passed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Step {stepDef?.stepNumber || sr.stepId}</p>
                  <p className="text-sm">{stepDef?.instruction}</p>
                  {stepDef?.expectedResult && <p className="text-xs text-muted-foreground mt-1">Expected: {stepDef.expectedResult}</p>}
                  {sr.actualResult && <p className="text-xs text-muted-foreground mt-1">Actual: {sr.actualResult}</p>}
                  {sr.comments && <p className="text-xs text-muted-foreground mt-1 italic">{sr.comments}</p>}
                  {sr.attachments?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sr.attachments.filter((a: any) => a.fileType?.startsWith("image/")).map((a: any) => (
                        <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noopener noreferrer">
                          <img src={`/api${a.fileUrl}`} alt={a.fileName} className="w-16 h-16 object-cover rounded-md border border-border" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (steps.length === 0 && activeExecution) {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto w-full">
        <header className="sticky top-0 z-10 bg-card border-b shadow-sm">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link href={`/tester/run/${trId}/scenario/${ucid}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-5 h-5" /></Button>
            </Link>
            <h1 className="font-bold text-sm truncate">{testCaseData?.title ?? `TC-${tcId}`}</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">No Steps Defined</p>
            <p className="text-xs text-muted-foreground mt-1">This test case has no test steps. It cannot be executed.</p>
          </div>
          <Link href={`/tester/run/${trId}/scenario/${ucid}`}>
            <Button variant="outline" className="mt-2">Back to Cases</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!activeExecution && !activeExecutionId) {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto w-full">
        <header className="sticky top-0 z-10 bg-card border-b shadow-sm">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link href={`/tester/run/${trId}/scenario/${ucid}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-5 h-5" /></Button>
            </Link>
            <h1 className="font-bold text-sm truncate">Start Execution</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Ready to Start</h2>
            <p className="text-sm text-muted-foreground mt-1">You will go through one step at a time.</p>
          </div>
          <Button onClick={handleStartExecution} className="w-full max-w-xs h-12 text-base" disabled={createExecution.isPending}>
            {createExecution.isPending ? "Starting..." : "Begin Testing"}
          </Button>
        </div>
      </div>
    );
  }

  const allSteps = steps;
  const currentStep = allSteps[currentStepIndex];
  const stepInput = currentStep ? stepInputs[currentStep.id] ?? { actualResult: "", comments: "", passed: null } : null;
  const totalSteps = allSteps.length;
  const progressValue = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;
  const allStepsDone = allSteps.every((s: any) => stepInputs[s.id]?.passed != null);

  const goNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  };
  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  };

  const handlePassFail = (passed: boolean) => {
    if (!currentStep) return;
    handleSaveStep(currentStep.id, { ...stepInputs[currentStep.id], passed });
    if (currentStepIndex === totalSteps - 1) {
      const allDone = allSteps.every((s: any) => {
        if (s.id === currentStep.id) return true;
        return stepInputs[s.id]?.passed != null;
      });
      if (allDone) {
        const anyFailed = allSteps.some((s: any) => {
          if (s.id === currentStep.id) return !passed;
          return stepInputs[s.id]?.passed === false;
        });
        if (anyFailed) {
          setDefectNotes("");
          setShowDefectDialog(true);
        } else {
          handleCompleteCase(true);
        }
      }
    } else {
      setTimeout(goNext, 300);
    }
  };

  const handleDefectConfirm = () => {
    setShowDefectDialog(false);
    handleCompleteCase(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto w-full">
      <header className="sticky top-0 z-10 bg-card border-b shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <button onClick={goPrev} disabled={currentStepIndex === 0} className="h-8 w-8 flex items-center justify-center disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-sm truncate px-2">{testCaseData?.title ?? `TC-${tcId}`}</h1>
          <button onClick={goNext} disabled={currentStepIndex >= totalSteps - 1} className="h-8 w-8 flex items-center justify-center disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {Math.round(progressValue)}%
            </span>
          </div>
          <Progress value={progressValue} className="h-1.5" />
        </div>
      </header>

      <div className="flex-1 p-4 pb-0 overflow-y-auto">
        {currentStep && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                {currentStep.stepNumber}
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <p className="text-base font-medium leading-relaxed">{currentStep.instruction}</p>
                {currentStep.testData && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block mb-1">Test Data</span>
                    <code className="text-sm font-mono text-amber-900">{currentStep.testData}</code>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block mb-1">Expected Result</span>
                  <p className="text-sm text-blue-900">{currentStep.expectedResult}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  What actually happened? <span className="text-destructive">*</span>
                </label>
                <Textarea
                  placeholder="Describe what happened..."
                  className="min-h-[80px] text-base resize-none"
                  value={stepInput?.actualResult ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStepInputs((prev) => ({
                      ...prev,
                      [currentStep.id]: { ...prev[currentStep.id] ?? { actualResult: "", comments: "", passed: null }, actualResult: val },
                    }));
                  }}
                  onBlur={() => currentStep && stepInput && handleSaveStep(currentStep.id, { actualResult: stepInput.actualResult })}
                />
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowComments((prev) => ({ ...prev, [currentStep.id]: !prev[currentStep.id] }))}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {showComments[currentStep.id] ? "- Hide" : "+ Add"} comment
                </button>
                {showComments[currentStep.id] && (
                  <Textarea
                    placeholder="Internal notes..."
                    className="min-h-[60px] text-sm resize-none"
                    value={stepInput?.comments ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStepInputs((prev) => ({
                        ...prev,
                        [currentStep.id]: { ...prev[currentStep.id] ?? { actualResult: "", comments: "", passed: null }, comments: val },
                      }));
                    }}
                    onBlur={() => currentStep && stepInput && handleSaveStep(currentStep.id, { comments: stepInput.comments })}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Photo Evidence</label>
                <EvidenceUpload
                  entityId={stepResultIdByStepId[currentStep.id] ?? 0}
                  entityType="step_result"
                  attachments={activeExecution?.stepResults?.find((sr: any) => sr.stepId === currentStep.id)?.attachments ?? []}
                  onUpdate={() => queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(tcId) })}
                  camera
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-background border-t p-4 space-y-2">
        <div className="flex gap-3">
          <Button
            variant={stepInput?.passed === false ? "destructive" : "outline"}
            className={cn("flex-1 h-12 text-base font-bold", stepInput?.passed === false && "ring-2 ring-destructive")}
            onClick={() => handlePassFail(false)}
          >
            <X className="w-5 h-5 mr-2" /> Fail
          </Button>
          <Button
            variant={stepInput?.passed === true ? "default" : "outline"}
            className={cn("flex-1 h-12 text-base font-bold", stepInput?.passed === true ? "bg-green-600 hover:bg-green-700" : "")}
            onClick={() => handlePassFail(true)}
          >
            <Check className="w-5 h-5 mr-2" /> Pass
          </Button>
        </div>
        {currentStepIndex < totalSteps - 1 && allStepsDone && (
          <Button className="w-full h-10" onClick={() => setShowCompletion(true)}>
            Complete Test Case
          </Button>
        )}
      </div>

      <Dialog open={showDefectDialog} onOpenChange={setShowDefectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Defect Notes
            </DialogTitle>
            <DialogDescription>
              A defect will be created for this failed execution. Add notes for the development team.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe what went wrong..."
            className="h-24 resize-none"
            value={defectNotes}
            onChange={(e) => setDefectNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowDefectDialog(false); setLocation(`/tester/run/${trId}/scenario/${ucid}`); }}>Cancel</Button>
            <Button onClick={handleDefectConfirm} disabled={updateExecution.isPending}>
              {updateExecution.isPending ? "Submitting..." : "Confirm Defect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

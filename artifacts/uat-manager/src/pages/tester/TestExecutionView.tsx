import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetProjectByCode, getGetProjectByCodeQueryKey,
  useListExecutions, getListExecutionsQueryKey,
  useCreateExecution
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Check, X, AlertCircle, Save, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

// A component for executing a single test case
function TestCaseExecutor({ testCase, projectCode, testerName, onComplete }: any) {
  const queryClient = useQueryClient();
  const { data: executions } = useListExecutions(testCase.id, {
    query: { enabled: !!testCase.id, queryKey: getListExecutionsQueryKey(testCase.id) }
  });
  
  const createExecution = useCreateExecution();

  const [actualResult, setActualResult] = useState("");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState<boolean | null>(null);

  const handleSubmit = async () => {
    if (status === null) return;
    
    await createExecution.mutateAsync({
      testCaseId: testCase.id,
      data: {
        testerName,
        actualResult,
        comments,
        passed: status
      }
    });
    
    queryClient.invalidateQueries({ queryKey: getListExecutionsQueryKey(testCase.id) });
    queryClient.invalidateQueries({ queryKey: getGetProjectByCodeQueryKey(projectCode) });
    onComplete();
  };

  const lastExecution = executions?.[0];

  return (
    <Card className="mb-6 border-2 border-primary/20 shadow-md">
      <CardHeader className="bg-primary/5 pb-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              TC-{testCase.caseNumber}
            </div>
            <CardTitle className="text-xl">{testCase.title}</CardTitle>
          </div>
          {lastExecution && (
            <div className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold border",
              lastExecution.passed 
                ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400" 
                : lastExecution.passed === false 
                  ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-gray-100 text-gray-800 border-gray-200"
            )}>
              Last: {lastExecution.passed ? 'PASSED' : lastExecution.passed === false ? 'FAILED' : 'PENDING'}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-8">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase text-muted-foreground border-b pb-2">Execution Steps</h4>
          {testCase.steps?.length > 0 ? (
            <div className="space-y-3">
              {testCase.steps.map((step: any) => (
                <div key={step.id} className="flex gap-4 p-3 bg-muted/30 rounded-lg">
                  <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {step.stepNumber}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">{step.instruction}</p>
                      {step.testData && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Data:</span>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{step.testData}</code>
                        </div>
                      )}
                    </div>
                    <div className="sm:border-l sm:pl-4">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">Expected</span>
                      <p className="text-sm text-primary/80 font-medium">{step.expectedResult}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No steps defined for this test case.</div>
          )}
        </div>

        <div className="space-y-4 border-t pt-6">
          <h4 className="text-sm font-semibold uppercase text-muted-foreground">Record Result</h4>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Actual Result</label>
              <Textarea 
                placeholder="What actually happened?" 
                value={actualResult}
                onChange={e => setActualResult(e.target.value)}
                className="h-20"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium block mb-1">Comments / Evidence Link</label>
              <Input 
                placeholder="Optional notes or links to screenshots" 
                value={comments}
                onChange={e => setComments(e.target.value)}
              />
            </div>
            
            <div className="pt-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  type="button"
                  variant={status === true ? "default" : "outline"} 
                  className={cn("flex-1 sm:w-32", status === true && "bg-green-600 hover:bg-green-700")}
                  onClick={() => setStatus(true)}
                >
                  <Check className="w-4 h-4 mr-2" /> Pass
                </Button>
                <Button 
                  type="button"
                  variant={status === false ? "destructive" : "outline"} 
                  className="flex-1 sm:w-32"
                  onClick={() => setStatus(false)}
                >
                  <X className="w-4 h-4 mr-2" /> Fail
                </Button>
              </div>
              
              <Button 
                onClick={handleSubmit} 
                disabled={status === null || createExecution.isPending}
                className="w-full sm:w-auto"
              >
                {createExecution.isPending ? "Saving..." : "Save Result"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TestExecutionView() {
  const { projectCode } = useParams();
  const code = projectCode?.toUpperCase() || "";
  const testerName = sessionStorage.getItem("testerName") || "Tester";

  const { data: project, isLoading } = useGetProjectByCode(code, {
    query: { enabled: !!code, queryKey: getGetProjectByCodeQueryKey(code) }
  });

  const [activeTestCaseId, setActiveTestCaseId] = useState<number | null>(null);

  if (isLoading) {
    return <div className="min-h-screen p-8 flex items-center justify-center animate-pulse">Loading Test Plan...</div>;
  }

  if (!project) {
    return <div className="min-h-screen p-8 text-center text-destructive">Project not found or access denied.</div>;
  }

  // Find the active test case object
  let activeTestCase = null;
  if (activeTestCaseId) {
    for (const uc of project.useCases) {
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
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium hidden sm:inline-block bg-muted px-2 py-1 rounded">
              Tester: {testerName}
            </span>
            <Link href="/tester">
              <Button variant="ghost" size="icon" title="Exit Execution">
                <LogOut className="w-5 h-5 text-muted-foreground" />
              </Button>
            </Link>
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
                testerName={testerName}
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
          {project.useCases.map((useCase) => {
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
                    const isPassed = lastExec?.passed === true;
                    const isFailed = lastExec?.passed === false;
                    
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
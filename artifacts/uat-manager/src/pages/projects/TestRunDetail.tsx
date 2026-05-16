import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  UserPlus,
  Trash2,
  PlayCircle,
  RotateCcw,
  Plus,
  Search,
  FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { exportTestRunToPDF } from "@/lib/export-utils";
import { 
  useGetTestRun, 
  useUpdateTestRun, 
  useUpdateTestRunUseCase, 
  useAddUseCaseToTestRun, 
  useRemoveUseCaseFromTestRun,
  useRerunTestRun,
  useGetTestRunFullReport,
  useListProjectUsers,
  useListUseCases,
  getGetTestRunQueryKey,
  getListProjectUsersQueryKey,
  getListUseCasesQueryKey,
  getGetTestRunFullReportQueryKey
} from "@workspace/api-client-react";
import type { User, TestRunDetail as APITestRunDetail, TestRunUseCase } from "@workspace/api-client-react";

const API_BASE = "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectUseCase {
  id: number;
  code: string;
  name: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function RunStatusBadge({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === "completed") {
    return passed ? (
      <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Passed
      </Badge>
    ) : (
      <Badge className="bg-red-500/15 text-red-600 border-red-500/30">
        <XCircle className="w-3 h-3 mr-1" /> Failed
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> In Progress
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
      <Clock className="w-3 h-3 mr-1" /> Scheduled
    </Badge>
  );
}

function UCStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    passed: "bg-green-500/15 text-green-600 border-green-500/30",
    failed: "bg-red-500/15 text-red-600 border-red-500/30",
  };
  return <Badge className={variants[status] || ""}>{status.replace("_", " ")}</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

import { TestRunResultsView } from "@/components/projects/TestRunResultsView";

export default function TestRunDetail() {
  const { projectId, testRunId } = useParams();
  const pId = parseInt(projectId || "0", 10);
  const trId = parseInt(testRunId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddUC, setShowAddUC] = useState(false);
  const [showRerun, setShowRerun] = useState(false);
  const [viewMode, setViewMode] = useState<"management" | "results">("management");

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: run, isLoading: isLoadingRun } = useGetTestRun(trId, {
    query: { enabled: !!trId, queryKey: getGetTestRunQueryKey(trId) }
  });

  const { data: assignments = [] } = useListProjectUsers(pId, {
    query: { enabled: !!pId, queryKey: getListProjectUsersQueryKey(pId) }
  });

  const { data: projectUseCases = [] } = useListUseCases(pId, {
    query: { enabled: !!pId && showAddUC, queryKey: getListUseCasesQueryKey(pId) }
  });

  const { data: detailedData, isLoading: isLoadingDetailed, refetch: fetchDetailed, isFetching: isFetchingDetailed } = useGetTestRunFullReport(trId, {
    query: {
      enabled: !!trId && viewMode === "results",
      queryKey: getGetTestRunFullReportQueryKey(trId)
    }
  });

  const handleExportDetailed = async () => {
    const { data: detailed } = await fetchDetailed();
    if (detailed) {
      exportTestRunToPDF(run, detailed);
    } else {
      toast({ title: "Failed to fetch detailed data", variant: "destructive" });
    }
  };

  // ── Mutations ───────────────────────────────────────────────────────────────

  const updateRunMutation = useUpdateTestRun();
  
  const updateUCMutation = useMutation({
    mutationFn: async ({ ucId, data }: { ucId: number; data: any }) => {
      const res = await fetch(`/api/test-runs/${trId}/use-cases/${ucId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: async ({ ucId, data }) => {
      const queryKey = getGetTestRunQueryKey(trId);
      await queryClient.cancelQueries({ queryKey });
      const previousRun = queryClient.getQueryData<APITestRunDetail>(queryKey);
      
      if (previousRun) {
        queryClient.setQueryData<APITestRunDetail>(queryKey, {
          ...previousRun,
          useCases: previousRun.useCases?.map(uc => 
            uc.id === ucId ? { ...uc, ...data } : uc
          )
        });
      }
      
      return { previousRun };
    },
    onError: (err, variables, context) => {
      const queryKey = getGetTestRunQueryKey(trId);
      if (context?.previousRun) {
        queryClient.setQueryData(queryKey, context.previousRun);
      }
      toast({ title: "Failed to update", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getGetTestRunQueryKey(trId) });
    }
  });

  const addUCMutation = useAddUseCaseToTestRun();
  const removeUCMutation = useRemoveUseCaseFromTestRun();
  const rerunMutation = useRerunTestRun({
    mutation: {
      onSuccess: (newRun) => {
        toast({ title: "Re-run created successfully" });
        setShowRerun(false);
        setLocation(`/projects/${pId}/test-runs/${newRun.id}`);
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to create re-run", 
          description: err.message || "An error occurred",
          variant: "destructive" 
        });
      }
    }
  });

  // ── Render Helpers ──────────────────────────────────────────────────────────

  if (isLoadingRun) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!run) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-xl font-bold">Test run not found</h2>
          <Link href={`/projects/${pId}/test-runs`}>
            <Button variant="link">Back to list</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const testers = assignments
    .filter(a => a.role === "TESTER" || a.role === "ADMIN")
    .map(a => a.user)
    .filter((u): u is User => !!u);

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={`/projects/${pId}/test-runs`}>
          <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Test Runs
          </Button>
        </Link>
      </div>

      <PageHeader
        title={run.name}
        description={
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="w-4 h-4" />
              {format(new Date(run.scheduledAt), "d MMM yyyy, HH:mm")}
            </div>
            <RunStatusBadge status={run.status} passed={run.passed ?? null} />
          </div>
        }
        actions={
          <div className="flex gap-2">
            {run.status === "scheduled" && (
              <Button
                size="sm"
                onClick={() => updateRunMutation.mutate({ testRunId: trId, data: { status: "in_progress" } })}
                disabled={updateRunMutation.isPending}
              >
                <PlayCircle className="w-4 h-4 mr-2" /> Start Run
              </Button>
            )}
            {run.status === "completed" && (
              <>
                <Button size="sm" variant="outline" onClick={() => exportTestRunToPDF(run)}>
                  <FileText className="w-4 h-4 mr-2" /> Summary PDF
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportDetailed} disabled={isFetchingDetailed}>
                  {isFetchingDetailed ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Detailed PDF
                </Button>
                {!run.passed && (
                  <Button size="sm" variant="outline" onClick={() => setShowRerun(true)}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Re-run Failed
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div>
                <CardTitle>Use Cases</CardTitle>
                <CardDescription>Manage use cases and tester assignments for this run.</CardDescription>
              </div>
              <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="management">Management</TabsTrigger>
                  <TabsTrigger value="results">View Results</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {run.status !== "completed" && viewMode === "management" && (
              <Button size="sm" variant="outline" onClick={() => setShowAddUC(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Use Case
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {viewMode === "results" ? (
              isLoadingDetailed ? (
                <div className="py-20 text-center animate-pulse text-muted-foreground">Loading detailed results...</div>
              ) : (
                <TestRunResultsView data={detailedData} />
              )
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Code</th>
                      <th className="text-left py-3 px-4 font-medium">Use Case</th>
                      <th className="text-left py-3 px-4 font-medium">Assigned Tester</th>
                      <th className="text-center py-3 px-4 font-medium">Free Pass</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                      {run.status !== "completed" && <th className="py-3 px-4"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {run.useCases.map((uc) => (
                      <tr key={uc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs">{uc.useCaseCode}</td>
                        <td className="py-3 px-4 font-medium">{uc.useCaseName}</td>
                        <td className="py-3 px-4">
                          <Select
                            disabled={run.status === "completed"}
                            value={uc.assignedTesterId?.toString() || "unassigned"}
                            onValueChange={(val) =>
                              updateUCMutation.mutate({
                                ucId: uc.id,
                                data: { assignedTesterId: val === "unassigned" ? null : parseInt(val) },
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-48">
                              <SelectValue placeholder="Assign tester" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {testers.map((t) => (
                                <SelectItem key={t.id} value={t.id.toString()}>
                                  {t.name} (@{t.username})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Switch
                            disabled={run.status === "completed"}
                            checked={uc.freePass}
                            onCheckedChange={(checked) =>
                              updateUCMutation.mutate({ ucId: uc.id, data: { freePass: checked } })
                            }
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <UCStatusBadge status={uc.status} />
                        </td>
                        {run.status !== "completed" && (
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              disabled={uc.status !== "pending"}
                              onClick={() => removeUCMutation.mutate({ testRunId: trId, testRunUseCaseId: uc.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {run.useCases.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground italic">
                          No use cases added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Add Use Case Dialog ────────────────────────────────────────────── */}
      <Dialog open={showAddUC} onOpenChange={setShowAddUC}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Use Case</DialogTitle>
            <DialogDescription>Select use cases from the project to add to this test run.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-2">
            {projectUseCases
              .filter((puc: any) => !run.useCases.some((uc: any) => uc.useCaseId === puc.id))
              .map((puc: any) => (
                <div key={puc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{puc.code}</span>
                    <span className="font-medium">{puc.name}</span>
                  </div>
                  <Button size="sm" onClick={() => addUCMutation.mutate({ testRunId: trId, data: { useCaseId: puc.id } })}>
                    Add
                  </Button>
                </div>
              ))}
            {projectUseCases.filter((puc: any) => !run.useCases.some((uc: any) => uc.useCaseId === puc.id)).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">All project use cases are already in this run.</div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowAddUC(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Re-run Dialog ─────────────────────────────────────────────────── */}
      <RerunDialog
        open={showRerun}
        onClose={() => setShowRerun(false)}
        onConfirm={(data) => rerunMutation.mutate({ testRunId: trId, data })}
        isPending={rerunMutation.isPending}
        runName={run.name}
      />
    </AppLayout>
  );
}

function RerunDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  runName,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  isPending: boolean;
  runName: string;
}) {
  const [name, setName] = useState(`Re-run: ${runName}`);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 1 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [failedOnly, setFailedOnly] = useState(true);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-run Test Run</DialogTitle>
          <DialogDescription>Create a new test run based on this one.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>New Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled Date &amp; Time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="failed-only" checked={failedOnly} onCheckedChange={setFailedOnly} />
            <Label htmlFor="failed-only">Only include failed use cases</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onConfirm({ name, scheduledAt: new Date(scheduledAt).toISOString(), failedOnly })}
            disabled={isPending || !name}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Re-run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

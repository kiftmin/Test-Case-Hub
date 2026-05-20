import { useState } from "react";
import { Link, useParams } from "wouter";
import { getAuthUser } from "@/lib/auth";
import {
  useGetProject,
  getGetProjectQueryKey,
  useListProjectUsers,
  getListProjectUsersQueryKey,
  useListTestRuns,
  getListTestRunsQueryKey,
  useGetTestRunFullReport,
  getGetTestRunFullReportQueryKey
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Edit2, Plus, LayoutList, Users, Download, FileJson, FileText, CalendarClock, CheckCircle2, ShieldCheck, AlertTriangle, Bug } from "lucide-react";
import { exportProjectToPDF, exportProjectToExcel } from "@/lib/export-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { UseCaseTree } from "@/components/projects/UseCaseTree";
import { TestCaseEditor } from "@/components/projects/TestCaseEditor";
import { Card } from "@/components/ui/card";
import { SignOffDialog } from "@/components/projects/SignOffDialog";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SignOffCertificate } from "@/components/projects/SignOffCertificate";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function ProjectDetail() {
  const { projectId } = useParams();
  const user = getAuthUser();
  const id = parseInt(projectId || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedTestCaseId, setSelectedTestCaseId] = useState<number | null>(null);
  const [showSignOff, setShowSignOff] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) }
  });

  const { data: assignments = [] } = useListProjectUsers(id, {
    query: { enabled: !!id, queryKey: getListProjectUsersQueryKey(id) }
  });

  const { data: testRuns = [] } = useListTestRuns(id, {
    query: { enabled: !!id, queryKey: getListTestRunsQueryKey(id) }
  });

  const projectRole = assignments.find(a => a.userId === user?.id)?.role;
  const isAdmin = user?.role === "ADMIN";
  const isTestLead = isAdmin || projectRole === "TEST_LEAD";
  const isBusinessOwner = projectRole === "BUSINESS_OWNER";
  const isAuthorOrAdmin = isAdmin || projectRole === "TEST_AUTHOR";
  const isSignedOff = (project as any)?.isSignedOff === 1;

  const signOffData = (project as any)?.signOffData ? JSON.parse((project as any).signOffData) : null;
  const lastCompletedRunId = signOffData?.lastTestRunId || testRuns.find(r => r.status === 'completed')?.id;

  const { data: lastRunReport } = useGetTestRunFullReport(lastCompletedRunId!, {
    query: {
      enabled: !!lastCompletedRunId && (showSignOff || showCertificate || !!(project as any)?.isSignedOff),
      queryKey: getGetTestRunFullReportQueryKey(lastCompletedRunId!)
    }
  });

  const signOffMutation = useMutation({
    mutationFn: async (confirmations: any) => {
      const res = await fetch(`/api/projects/${id}/sign-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, confirmations }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sign-off failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Project signed off successfully" });
      setShowSignOff(false);
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
    },
    onError: (err: any) => {
      toast({ title: "Sign-off failed", description: err.message, variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="flex gap-6 h-[600px]">
            <div className="w-1/3 bg-muted/20 rounded"></div>
            <div className="flex-1 bg-muted/20 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12">Project not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Projects
          </Button>
        </Link>
      </div>

      <PageHeader
        title={project.name}
        description={
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-muted-foreground">Code: {project.projectCode} • Version {project.version}.0</span>
            {(project as any).isSignedOff === 1 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-800 border border-green-200 rounded-full text-[10px] font-bold uppercase">
                <CheckCircle2 className="w-3 h-3" /> Signed Off
              </div>
            )}
          </div>
        }
        actions={
          <>
            {(project as any).isSignedOff === 1 && user?.role !== "USER" ? (
              <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800">
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Sign-off Certificate
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Project Sign-off Certificate</DialogTitle>
                  </DialogHeader>
                  {showCertificate && lastRunReport && (
                    <SignOffCertificate
                      project={project}
                      signOffData={signOffData}
                      lastRun={lastRunReport}
                    />
                  )}
                </DialogContent>
              </Dialog>
            ) : (
              (isTestLead || isBusinessOwner) && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setShowSignOff(true)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Sign Off Project
                </Button>
              )
            )}
            <Link href={`/projects/${id}/defects`}>
              <Button variant="outline" size="sm">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Defects
              </Button>
            </Link>
            <Link href={`/projects/${id}/bugs`}>
              <Button variant="outline" size="sm">
                <Bug className="w-4 h-4 mr-2" />
                Bugs
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export Plan
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportProjectToPDF(project)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportProjectToExcel(project)}>
                  <FileJson className="w-4 h-4 mr-2" />
                  Download Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isTestLead && (
              <Link href={`/projects/${id}/users`}>
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
            )}
            <Link href={`/projects/${id}/test-runs`}>
              <Button variant="outline" size="sm">
                <CalendarClock className="w-4 h-4 mr-2" />
                Test Runs
              </Button>
            </Link>
            {isAuthorOrAdmin && (
              <>
                <Link href={`/projects/${id}/stats`}>
                  <Button variant="outline" size="sm">
                    <LayoutList className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                </Link>
                <Link href={`/projects/${id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Metadata
                  </Button>
                </Link>
              </>
            )}
            <Link href={`/tester`} target="_blank">
              <Button size="sm">
                Tester Portal
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
        <Card className="w-full md:w-80 flex flex-col overflow-hidden border-border bg-card">
          <div className="p-4 border-b font-medium text-sm flex justify-between items-center bg-muted/30">
            Use Cases
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <UseCaseTree
              project={project}
              selectedTestCaseId={selectedTestCaseId}
              onSelectTestCase={setSelectedTestCaseId}
              readOnly={isSignedOff || !isAuthorOrAdmin}
            />
          </div>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden border-border bg-card">
          {selectedTestCaseId ? (
            <TestCaseEditor testCaseId={selectedTestCaseId} readOnly={isSignedOff || !isAuthorOrAdmin} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <LayoutList className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Test Case Selected</h3>
              <p className="mt-1 text-sm">Select a test case from the sidebar to view or edit its steps.</p>
            </div>
          )}
        </Card>
      </div>

      {project && (
        <SignOffDialog
          open={showSignOff}
          onOpenChange={setShowSignOff}
          project={project}
          onSignOff={(confirmations) => signOffMutation.mutateAsync(confirmations)}
          isPending={signOffMutation.isPending}
        />
      )}
    </AppLayout>
  );
}

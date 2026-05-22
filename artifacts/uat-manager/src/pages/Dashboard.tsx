import { useState } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useListUsers,
  useGetDeveloperBugs,
  getGetDeveloperBugsQueryKey,
  useUpdateBugStatus,
  useUpdateBugNotes,
} from "@workspace/api-client-react";
import type { DeveloperBugItem, UpdateBugStatusBodyStatus } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Activity, CheckCircle2, FolderKanban, ListTodo, Bug, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getAuthUser } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

const bugStatusColors: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700 border-red-200",
  ASSIGNED: "bg-blue-100 text-blue-700 border-blue-200",
  RESOLVED: "bg-green-100 text-green-700 border-green-200",
  TEST: "bg-purple-100 text-purple-700 border-purple-200",
  FAILED_TO_RESOLVE: "bg-amber-100 text-amber-700 border-amber-200",
  CLOSED: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function Dashboard() {
  const currentUser = getAuthUser();
  const queryClient = useQueryClient();
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: recentActivity, isLoading: isActivityLoading } = useGetRecentActivity();
  const { data: users } = useListUsers();
  const { data: developerBugs } = useGetDeveloperBugs(currentUser?.id ?? 0, { query: { queryKey: getGetDeveloperBugsQueryKey(currentUser?.id ?? 0), enabled: !!currentUser?.id } });

  const updateStatus = useUpdateBugStatus();
  const updateNotes = useUpdateBugNotes();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [modalBug, setModalBug] = useState<DeveloperBugItem | null>(null);
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<UpdateBugStatusBodyStatus | "">("");
  const [notesText, setNotesText] = useState("");

  const filteredBugs = developerBugs?.filter((b) => !statusFilter || b.status === statusFilter) ?? [];

  const handleUpdateStatus = async () => {
    if (!modalBug?.id || !newStatus) return;
    try {
      await updateStatus.mutateAsync({ bugId: modalBug.id, data: { status: newStatus } });
      toast.success("Bug status updated");
      queryClient.invalidateQueries({ queryKey: [`/api/dashboard/developer/${currentUser?.id}/bugs`] });
      setModalBug(null);
      setModalAction(null);
    } catch { toast.error("Failed to update status"); }
  };

  const handleUpdateNotes = async () => {
    if (!modalBug?.id || !notesText.trim()) return;
    try {
      await updateNotes.mutateAsync({ bugId: modalBug.id, data: { notes: notesText } });
      toast.success("Notes updated");
      queryClient.invalidateQueries({ queryKey: [`/api/dashboard/developer/${currentUser?.id}/bugs`] });
      setModalBug(null);
      setModalAction(null);
    } catch { toast.error("Failed to update notes"); }
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Dashboard" 
        description="Overview of your testing operations and recent activity."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalProjects || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Active test projects
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Test Cases</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalTestCases || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Registered system users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">
                {summary?.passRate ? `${summary.passRate.toFixed(1)}%` : '0%'}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Global passing average
            </p>
          </CardContent>
        </Card>
      </div>

      {developerBugs && developerBugs.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">My Assigned Bugs</h2>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="ASSIGNED">ASSIGNED</SelectItem>
                  <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                  <SelectItem value="TEST">TEST</SelectItem>
                  <SelectItem value="FAILED_TO_RESOLVE">FAILED_TO_RESOLVE</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bug #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Test Case</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBugs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No bugs found.</TableCell>
                  </TableRow>
                ) : (
                  filteredBugs.map((bug) => (
                    <TableRow key={bug.id}>
                      <TableCell className="font-mono text-xs">#{bug.bugNumber}</TableCell>
                      <TableCell className="text-sm">{bug.projectName}</TableCell>
                      <TableCell className="text-sm">{bug.testCaseName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-bold ${bugStatusColors[bug.status || ""] || ""}`}>
                          {bug.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {bug.updatedAt ? format(new Date(bug.updatedAt), "MMM d") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Change Status"
                            onClick={() => { setModalBug(bug); setModalAction("status"); setNewStatus(""); }}>
                            <Activity className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit Notes"
                            onClick={() => { setModalBug(bug); setModalAction("notes"); setNotesText(bug.developerNotes || ""); }}>
                            <Bug className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      <h2 className="text-xl font-bold tracking-tight mb-4">Recent Executions</h2>
      <Card>
        <div className="divide-y divide-border">
          {isActivityLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading activity...</div>
          ) : !recentActivity || recentActivity.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No recent activity found.</div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.executionId} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${activity.passed === true ? 'bg-green-500' : activity.passed === false ? 'bg-destructive' : 'bg-yellow-500'}`} />
                  <div>
                    <p className="font-medium text-sm">
                      {activity.testCaseName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{activity.projectName}</span>
                      <span>&bull;</span>
                      <span>Executed by {activity.testerName}</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(activity.executedAt), "MMM d, h:mm a")}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Change Status Dialog */}
      <Dialog open={modalAction === "status"} onOpenChange={(o) => !o && setModalAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Bug Status</DialogTitle>
            <DialogDescription>Update the status of bug #{modalBug?.bugNumber}.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as UpdateBugStatusBodyStatus | "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                <SelectItem value="FAILED_TO_RESOLVE">FAILED_TO_RESOLVE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={updateStatus.isPending || !newStatus}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <Dialog open={modalAction === "notes"} onOpenChange={(o) => !o && setModalAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Developer Notes</DialogTitle>
            <DialogDescription>Update notes for bug #{modalBug?.bugNumber}.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Developer notes..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancel</Button>
            <Button onClick={handleUpdateNotes} disabled={updateNotes.isPending || !notesText.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
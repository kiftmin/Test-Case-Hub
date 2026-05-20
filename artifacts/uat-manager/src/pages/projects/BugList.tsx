import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useListBugs,
  useGetProject,
  useListProjectUsers,
  useAssignBug,
  useUpdateBugStatus,
  useUpdateBugNotes,
  useReassignBug,
  useListUsers,
} from "@workspace/api-client-react";
import type { ListBugsParams } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, Search, UserPlus, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getAuthUser } from "@/lib/auth";
import { roleBadgeClass, roleLabel } from "@/lib/role-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700 border-red-200",
  ASSIGNED: "bg-blue-100 text-blue-700 border-blue-200",
  RESOLVED: "bg-green-100 text-green-700 border-green-200",
  TEST: "bg-purple-100 text-purple-700 border-purple-200",
  FAILED_TO_RESOLVE: "bg-amber-100 text-amber-700 border-amber-200",
  CLOSED: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function BugList() {
  const { projectId } = useParams();
  const pid = parseInt(projectId || "0", 10);
  const currentUser = getAuthUser();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<ListBugsParams>({});
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeBugId, setActiveBugId] = useState<number | null>(null);
  const [assignDevId, setAssignDevId] = useState("");
  const [assignTicket, setAssignTicket] = useState("");
  const [statusVal, setStatusVal] = useState("");
  const [notesVal, setNotesVal] = useState("");
  const [reassignDevId, setReassignDevId] = useState("");

  const { data: project } = useGetProject(pid, { query: { enabled: !!pid } });
  const { data: bugs, isLoading } = useListBugs(pid, filters, { query: { enabled: !!pid } });
  const { data: assignments = [] } = useListProjectUsers(pid, { query: { enabled: !!pid } });
  const { data: allUsers } = useListUsers();

  const assignBug = useAssignBug();
  const updateStatus = useUpdateBugStatus();
  const updateNotes = useUpdateBugNotes();
  const reassignBug = useReassignBug();

  const projectRole = assignments.find(a => a.userId === currentUser?.id)?.role;
  const isAdmin = currentUser?.role === "ADMIN";
  const isTestLead = isAdmin || projectRole === "TEST_LEAD";
  const isDeveloper = projectRole === "DEVELOPER";

  const developers = allUsers?.filter(u =>
    assignments?.some(a => a.userId === u.id && (a.role === "DEVELOPER" || a.role === "TEST_LEAD"))
  ) || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bugs"] });

  const openModal = (modal: string, bugId: number) => {
    setActiveModal(modal);
    setActiveBugId(bugId);
    setAssignDevId("");
    setAssignTicket("");
    setStatusVal("");
    setNotesVal("");
    setReassignDevId("");
  };
  const closeModal = () => { setActiveModal(null); setActiveBugId(null); };

  const handleAssign = async () => {
    if (!activeBugId || !assignDevId) return;
    try {
      await assignBug.mutateAsync({ bugId: activeBugId, data: { developerId: parseInt(assignDevId, 10), supportTicketNumber: assignTicket || undefined } });
      toast.success("Bug assigned");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to assign bug"); }
  };

  const handleStatus = async () => {
    if (!activeBugId || !statusVal) return;
    try {
      await updateStatus.mutateAsync({ bugId: activeBugId, data: { status: statusVal as any } });
      toast.success("Status updated");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to update status"); }
  };

  const handleNotes = async () => {
    if (!activeBugId || !notesVal.trim()) return;
    try {
      await updateNotes.mutateAsync({ bugId: activeBugId, data: { notes: notesVal } });
      toast.success("Notes updated");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to update notes"); }
  };

  const handleReassign = async () => {
    if (!activeBugId || !reassignDevId) return;
    try {
      await reassignBug.mutateAsync({ bugId: activeBugId, data: { developerId: parseInt(reassignDevId, 10) } });
      toast.success("Bug reassigned");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to reassign bug"); }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={`/projects/${pid}`}>
          <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Project
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Bugs — ${project?.name || ""}`}
        description="Track and manage bugs reported from defect flagging."
      />

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={filters.status || ""} onValueChange={(v) => setFilters({ ...filters, status: v || undefined })}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All</SelectItem>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="ASSIGNED">ASSIGNED</SelectItem>
                  <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                  <SelectItem value="TEST">TEST</SelectItem>
                  <SelectItem value="FAILED_TO_RESOLVE">FAILED TO RESOLVE</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Developer</label>
              <Select value={filters.developerId?.toString() || ""} onValueChange={(v) => setFilters({ ...filters, developerId: v ? parseInt(v, 10) : undefined })}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All developers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All</SelectItem>
                  {developers.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Ticket #</label>
              <Input
                className="w-40 h-9"
                placeholder="Search..."
                value={filters.ticketNumber || ""}
                onChange={(e) => setFilters({ ...filters, ticketNumber: e.target.value || undefined })}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setFilters({})}>
              <RefreshCw className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
          ) : bugs?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground">No Bugs</h3>
              <p className="text-sm mt-1">No bugs have been flagged for this project.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bug #</TableHead>
                  <TableHead>Support Ticket</TableHead>
                  <TableHead>Defect</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugs?.map((bug) => (
                  <TableRow key={bug.id}>
                    <TableCell className="font-mono text-xs">#{bug.bugNumber}</TableCell>
                    <TableCell className="text-xs">{bug.supportTicketNumber || "—"}</TableCell>
                    <TableCell className="text-xs">#{bug.defectId}</TableCell>
                    <TableCell className="text-xs">{bug.assignedDeveloper?.name || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[bug.status] || "bg-gray-100 text-gray-700"}`}>
                        {bug.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(bug.openedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(isTestLead || isDeveloper) && (
                          <>
                            {(isTestLead || (isDeveloper && bug.assignedDeveloperId === currentUser?.id)) && (
                              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openModal("status", bug.id)} title="Update Status">
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {(isTestLead || (isDeveloper && bug.assignedDeveloperId === currentUser?.id)) && (
                              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openModal("notes", bug.id)} title="Edit Notes">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                        {isTestLead && !bug.assignedDeveloperId && (
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openModal("assign", bug.id)} title="Assign">
                            <UserPlus className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isTestLead && bug.status === "FAILED_TO_RESOLVE" && (
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openModal("reassign", bug.id)} title="Reassign">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Bug */}
      <Dialog open={activeModal === "assign"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Bug</DialogTitle><DialogDescription>Assign this bug to a developer.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Developer</label>
              <Select value={assignDevId} onValueChange={setAssignDevId}>
                <SelectTrigger><SelectValue placeholder="Select developer..." /></SelectTrigger>
                <SelectContent>
                  {developers.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Support Ticket # (optional)</label>
              <Input value={assignTicket} onChange={e => setAssignTicket(e.target.value)} placeholder="e.g. TICKET-123" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignDevId || assignBug.isPending}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status */}
      <Dialog open={activeModal === "status"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Status</DialogTitle><DialogDescription>Change the bug status.</DialogDescription></DialogHeader>
          <div className="py-4">
            <Select value={statusVal} onValueChange={setStatusVal}>
              <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSIGNED">ASSIGNED</SelectItem>
                <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                <SelectItem value="TEST">TEST</SelectItem>
                <SelectItem value="FAILED_TO_RESOLVE">FAILED TO RESOLVE</SelectItem>
                <SelectItem value="CLOSED">CLOSED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleStatus} disabled={!statusVal || updateStatus.isPending}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes */}
      <Dialog open={activeModal === "notes"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Developer Notes</DialogTitle><DialogDescription>Update the developer notes for this bug.</DialogDescription></DialogHeader>
          <div className="py-4">
            <Textarea value={notesVal} onChange={e => setNotesVal(e.target.value)} placeholder="Developer notes..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleNotes} disabled={!notesVal.trim() || updateNotes.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Bug */}
      <Dialog open={activeModal === "reassign"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reassign Bug</DialogTitle><DialogDescription>Reassign this bug to another developer.</DialogDescription></DialogHeader>
          <div className="py-4">
            <Select value={reassignDevId} onValueChange={setReassignDevId}>
              <SelectTrigger><SelectValue placeholder="Select developer..." /></SelectTrigger>
              <SelectContent>
                {developers.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleReassign} disabled={!reassignDevId || reassignBug.isPending}>Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

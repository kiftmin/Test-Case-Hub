import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useListDefects,
  useGetTestRun,
  useFlagDefectAsBug,
  useFlagDefectForRetest,
  useFlagDefectAcceptedByBusiness,
  useBusinessAcceptDefect,
  useBusinessRejectDefect,
  useAddDefectNote,
  useListProjectUsers,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Bug, AlertTriangle, RotateCcw, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { getAuthUser } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { TeamDiscussionDialog } from "@/components/projects/TeamDiscussionDialog";
import { ActiveDiscussionBanner } from "@/components/projects/ActiveDiscussionBanner";

const statusColors: Record<string, string> = {
  "New Defect": "bg-red-100 text-red-700 border-red-200",
  "Ready for Testing": "bg-amber-100 text-amber-700 border-amber-200",
  "Submitted to Dev to Fix": "bg-blue-100 text-blue-700 border-blue-200",
  "Accepted by Business": "bg-green-100 text-green-700 border-green-200",
};

export default function DefectLog() {
  const { projectId, testRunId } = useParams();
  const pid = parseInt(projectId || "0", 10);
  const tid = parseInt(testRunId || "0", 10);
  const currentUser = getAuthUser();
  const queryClient = useQueryClient();

  const { data: defects, isLoading } = useListDefects(tid, { query: { enabled: !!tid } });
  const { data: testRun } = useGetTestRun(tid, { query: { enabled: !!tid } });
  const { data: assignments = [] } = useListProjectUsers(pid, { query: { enabled: !!pid } });

  const flagBug = useFlagDefectAsBug();
  const flagRetest = useFlagDefectForRetest();
  const flagAccepted = useFlagDefectAcceptedByBusiness();
  const acceptDefect = useBusinessAcceptDefect();
  const rejectDefect = useBusinessRejectDefect();
  const addNote = useAddDefectNote();

  const projectRole = assignments.find(a => a.userId === currentUser?.id)?.role;
  const isAdmin = currentUser?.role === "ADMIN";
  const isTestLead = isAdmin || projectRole === "TEST_LEAD";
  const isBusinessOwner = projectRole === "BUSINESS_OWNER";

  const [expandedDefect, setExpandedDefect] = useState<number | null>(null);
  const [retestReason, setRetestReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [acceptNote, setAcceptNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeDefectId, setActiveDefectId] = useState<number | null>(null);
  const [discussionId, setDiscussionId] = useState<number | null>(null);
  const [showStartDiscussion, setShowStartDiscussion] = useState(false);

  const openModal = (modal: string, defectId: number) => {
    setActiveModal(modal);
    setActiveDefectId(defectId);
    if (modal === "retest") setRetestReason("");
    if (modal === "note") setNoteText("");
    if (modal === "accept") setAcceptNote("");
    if (modal === "reject") setRejectReason("");
  };

  const closeModal = () => {
    setActiveModal(null);
    setActiveDefectId(null);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["defects"] });

  const handleFlagBug = async () => {
    if (!activeDefectId) return;
    try {
      await flagBug.mutateAsync({ defectId: activeDefectId });
      toast.success("Bug created from defect");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to flag as bug"); }
  };

  const handleFlagRetest = async () => {
    if (!activeDefectId || !retestReason.trim()) return;
    try {
      await flagRetest.mutateAsync({ defectId: activeDefectId, data: { reason: retestReason } });
      toast.success("Defect flagged for retesting");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to flag for retest"); }
  };

  const handleFlagAccepted = async () => {
    if (!activeDefectId) return;
    try {
      await flagAccepted.mutateAsync({ defectId: activeDefectId });
      toast.success("Defect flagged as accepted by business");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to flag accepted"); }
  };

  const handleBusinessAccept = async () => {
    if (!activeDefectId || !acceptNote.trim()) return;
    try {
      await acceptDefect.mutateAsync({ defectId: activeDefectId, data: { note: acceptNote } });
      toast.success("Defect accepted");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to accept defect"); }
  };

  const handleBusinessReject = async () => {
    if (!activeDefectId) return;
    try {
      await rejectDefect.mutateAsync({ defectId: activeDefectId, data: rejectReason ? { reason: rejectReason } : undefined });
      toast.success("Defect rejected");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to reject defect"); }
  };

  const handleAddNote = async () => {
    if (!activeDefectId || !noteText.trim()) return;
    try {
      await addNote.mutateAsync({ defectId: activeDefectId, data: { note: noteText } });
      toast.success("Note added");
      closeModal();
      invalidate();
    } catch { toast.error("Failed to add note"); }
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

      <div className="flex items-center justify-between gap-4 mb-2">
        <PageHeader
          title={`Defect Log${testRun ? ` — ${testRun.name}` : ""}`}
          description="Review and manage defects identified during this test run."
        />
        {isTestLead && !discussionId && (
          <Button variant="outline" size="sm" onClick={() => setShowStartDiscussion(true)} className="shrink-0">
            <MessagesSquare className="w-4 h-4 mr-1" /> Start Team Discussion
          </Button>
        )}
      </div>

      {discussionId && (
        <ActiveDiscussionBanner
          discussionId={discussionId}
          projectId={pid}
          onEnded={() => setDiscussionId(null)}
        />
      )}

      <TeamDiscussionDialog
        projectId={pid}
        testRunId={tid}
        open={showStartDiscussion}
        onOpenChange={setShowStartDiscussion}
        onSuccess={(id) => setDiscussionId(id)}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : defects?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium text-foreground">No Defects</h3>
            <p className="text-sm mt-1">No defects have been reported for this test run.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {defects?.map((defect) => (
            <Card key={defect.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[defect.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {defect.status}
                      </span>
                      <span className="text-xs text-muted-foreground">Defect #{defect.id}</span>
                    </div>
                    {defect.testerNotes && (
                      <p className="text-sm text-muted-foreground mb-2">{defect.testerNotes}</p>
                    )}
                    {defect.retestReason && (
                      <p className="text-xs text-amber-600">Retest reason: {defect.retestReason}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Test Case: {defect.testCase?.title || `#${defect.testCaseId}`}</span>
                      <span>Created: {new Date(defect.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    {isTestLead && defect.status === "New Defect" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openModal("flag-bug", defect.id)} title="Flag as Bug">
                          <Bug className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openModal("retest", defect.id)} title="Flag for Retesting">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openModal("flag-accepted", defect.id)} title="Flag Accepted by Business">
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {isBusinessOwner && (defect.status === "Ready for Testing" || defect.status === "New Defect") && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openModal("accept", defect.id)} title="Accept">
                          <ThumbsUp className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openModal("reject", defect.id)} title="Reject">
                          <ThumbsDown className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openModal("note", defect.id)} title="Add Note">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpandedDefect(expandedDefect === defect.id ? null : defect.id)}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {expandedDefect === defect.id && defect.notes && defect.notes.length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
                    {defect.notes.map((note) => (
                      <div key={note.id} className="text-sm bg-muted/30 rounded p-3">
                        <p>{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          by user #{note.addedByUserId} — {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Flag as Bug confirm */}
      <Dialog open={activeModal === "flag-bug"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag as Bug</DialogTitle>
            <DialogDescription>This will create a bug record and submit the defect to development.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleFlagBug} disabled={flagBug.isPending}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag for Retesting */}
      <Dialog open={activeModal === "retest"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag for Retesting</DialogTitle>
            <DialogDescription>Provide a reason for retesting.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for retesting..."
              value={retestReason}
              onChange={(e) => setRetestReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleFlagRetest} disabled={flagRetest.isPending || !retestReason.trim()}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Accepted by Business confirm */}
      <Dialog open={activeModal === "flag-accepted"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Accepted by Business</DialogTitle>
            <DialogDescription>Mark this defect as accepted by business.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleFlagAccepted} disabled={flagAccepted.isPending}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Accept */}
      <Dialog open={activeModal === "accept"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Defect</DialogTitle>
            <DialogDescription>Add a note for accepting this defect.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Acceptance note..."
              value={acceptNote}
              onChange={(e) => setAcceptNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleBusinessAccept} disabled={acceptDefect.isPending || !acceptNote.trim()}>Accept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Reject */}
      <Dialog open={activeModal === "reject"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Defect</DialogTitle>
            <DialogDescription>Optionally provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Reason (optional)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleBusinessReject} disabled={rejectDefect.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note */}
      <Dialog open={activeModal === "note"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>Add a note to this defect.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Your note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={addNote.isPending || !noteText.trim()}>Add Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

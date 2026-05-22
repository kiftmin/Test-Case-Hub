import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useListProjectUsers,
  useCreateDiscussion,
  getListProjectUsersQueryKey,
  CreateDiscussionBodyMeetingType,
  type CreateDiscussionBodyMeetingType as MeetingType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TeamDiscussionDialogProps {
  projectId: number;
  testRunId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (discussionId: number) => void;
}

export function TeamDiscussionDialog({ projectId, testRunId, open, onOpenChange, onSuccess }: TeamDiscussionDialogProps) {
  const { data: assignments = [] } = useListProjectUsers(projectId, {
    query: { queryKey: getListProjectUsersQueryKey(projectId), enabled: !!projectId },
  });
  const createDiscussion = useCreateDiscussion();
  const queryClient = useQueryClient();

  const [meetingType, setMeetingType] = useState<MeetingType>(CreateDiscussionBodyMeetingType.defect_review);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);

  const handleToggleParticipant = (userId: number) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleMeetingTypeChange = (value: MeetingType) => {
    setMeetingType(value);
    if (value === CreateDiscussionBodyMeetingType.post_mortem) {
      const bizOwners = assignments
        .filter((a) => a.role === "BUSINESS_OWNER")
        .map((a) => a.userId);
      setSelectedParticipants(bizOwners);
    } else {
      const developers = assignments
        .filter((a) => a.role === "DEVELOPER")
        .map((a) => a.userId);
      setSelectedParticipants(developers);
    }
  };

  const handleSubmit = async () => {
    if (!meetingType || selectedParticipants.length === 0) return;
    try {
      const result = await createDiscussion.mutateAsync({
        testRunId,
        data: { meetingType, participantIds: selectedParticipants },
      });
      toast.success("Team discussion started");
      queryClient.invalidateQueries({ queryKey: ["discussions"] });
      onSuccess?.(result.id);
      onOpenChange(false);
    } catch {
      toast.error("Failed to start discussion");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Team Discussion</DialogTitle>
          <DialogDescription>Create a discussion to review defects with the team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Meeting Type</Label>
            <Select value={meetingType} onValueChange={(v) => handleMeetingTypeChange(v as MeetingType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CreateDiscussionBodyMeetingType.defect_review}>Defect Review</SelectItem>
                <SelectItem value={CreateDiscussionBodyMeetingType.post_mortem}>Post-Mortem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Participants</Label>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
              {assignments.length === 0 && (
                <p className="text-sm text-muted-foreground px-2 py-1">No project users available</p>
              )}
              {assignments.map((a) => (
                <label
                  key={a.userId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(a.userId)}
                    onChange={() => handleToggleParticipant(a.userId)}
                    className="rounded"
                  />
                  <span>{a.user?.name || `User #${a.userId}`}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto uppercase">{a.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createDiscussion.isPending || selectedParticipants.length === 0}>
            Start Discussion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

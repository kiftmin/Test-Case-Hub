import { useState } from "react";
import {
  useGetDiscussion,
  useEndDiscussion,
  useAddParticipant,
  useRemoveParticipant,
  useListProjectUsers,
  getGetDiscussionQueryKey,
  getListProjectUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessagesSquare, UserPlus, XCircle } from "lucide-react";

interface ActiveDiscussionBannerProps {
  discussionId: number;
  projectId: number;
  onEnded?: () => void;
}

export function ActiveDiscussionBanner({ discussionId, projectId, onEnded }: ActiveDiscussionBannerProps) {
  const { data: discussion } = useGetDiscussion(discussionId, { query: { queryKey: getGetDiscussionQueryKey(discussionId), enabled: !!discussionId } });
  const { data: assignments = [] } = useListProjectUsers(projectId, { query: { queryKey: getListProjectUsersQueryKey(projectId), enabled: !!projectId } });
  const endDiscussion = useEndDiscussion();
  const addParticipant = useAddParticipant();
  const removeParticipant = useRemoveParticipant();
  const queryClient = useQueryClient();

  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantId, setNewParticipantId] = useState<string>("");

  if (!discussion) return null;

  const handleEnd = async () => {
    try {
      await endDiscussion.mutateAsync({ discussionId });
      toast.success("Discussion ended");
      queryClient.invalidateQueries({ queryKey: ["discussions"] });
      onEnded?.();
    } catch {
      toast.error("Failed to end discussion");
    }
  };

  const handleAddParticipant = async () => {
    if (!newParticipantId) return;
    try {
      await addParticipant.mutateAsync({
        discussionId,
        data: { userId: parseInt(newParticipantId, 10) },
      });
      toast.success("Participant added");
      queryClient.invalidateQueries({ queryKey: [`/api/discussions/${discussionId}`] });
      setShowAddParticipant(false);
      setNewParticipantId("");
    } catch {
      toast.error("Failed to add participant");
    }
  };

  const handleRemoveParticipant = async (userId: number) => {
    try {
      await removeParticipant.mutateAsync({ discussionId, userId });
      toast.success("Participant removed");
      queryClient.invalidateQueries({ queryKey: [`/api/discussions/${discussionId}`] });
    } catch {
      toast.error("Failed to remove participant");
    }
  };

  const existingParticipantIds = discussion.participants?.map((p) => p.userId) || [];
  const availableUsers = assignments.filter((a) => !existingParticipantIds.includes(a.userId));

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <MessagesSquare className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-blue-900">Active Team Discussion</span>
                <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">
                  {(discussion.meetingType as string).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {discussion.participants?.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-[11px] gap-1">
                    {p.user?.name || `User #${p.userId}`}
                    <button
                      onClick={() => handleRemoveParticipant(p.userId)}
                      className="hover:text-destructive ml-0.5"
                      title="Remove participant"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowAddParticipant(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Add
            </Button>
            <Button variant="outline" size="sm" onClick={handleEnd} disabled={endDiscussion.isPending}>
              End Discussion
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
            <DialogDescription>Select a project user to add to this discussion.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>User</Label>
            <Select value={newParticipantId} onValueChange={setNewParticipantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 && (
                  <SelectItem value="" disabled>No available users</SelectItem>
                )}
                {availableUsers.map((a) => (
                  <SelectItem key={a.userId} value={String(a.userId)}>
                    {a.user?.name || `User #${a.userId}`} ({a.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddParticipant(false)}>Cancel</Button>
            <Button onClick={handleAddParticipant} disabled={!newParticipantId || addParticipant.isPending}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

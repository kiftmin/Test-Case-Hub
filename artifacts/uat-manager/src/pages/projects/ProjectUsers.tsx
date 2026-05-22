import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProject,
  useListUsers,
  useListProjectUsers,
  useAssignUserToProject,
  useRemoveUserFromProject
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, UserPlus, UserMinus, Bug, Ban, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { roleBadgeClass, roleLabel } from "@/lib/role-utils";
import { getAuthUser } from "@/lib/auth";

const projectRoles = [
  { value: "TEST_LEAD", label: "Test Lead" },
  { value: "TEST_AUTHOR", label: "Test Author" },
  { value: "BUSINESS_OWNER", label: "Business Owner" },
  { value: "TESTER", label: "Tester" },
  { value: "DEVELOPER", label: "Developer" },
];

export default function ProjectUsers() {
  const { projectId } = useParams();
  const id = parseInt(projectId || "0", 10);
  const currentUser = getAuthUser();

  const { data: project, isLoading: isProjectLoading } = useGetProject(id);
  const isSignedOff = (project as any)?.isSignedOff === 1;
  const { data: assignments, isLoading: isAssignmentsLoading, refetch: refetchAssignments } = useListProjectUsers(id);
  const { data: allUsers, isLoading: isUsersLoading } = useListUsers();

  const projectRole = assignments?.find((a) => a.userId === currentUser?.id)?.role;
  const canManageUsers = currentUser?.role === "ADMIN" || projectRole === "TEST_LEAD";

  const assignMutation = useAssignUserToProject();
  const removeMutation = useRemoveUserFromProject();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("TEST_LEAD");
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<number | null>(null);

  const handleAssign = async () => {
    if (!selectedUserId) return;

    try {
      await assignMutation.mutateAsync({
        projectId: id,
        data: {
          userId: parseInt(selectedUserId, 10),
          role: selectedRole
        }
      });
      toast.success("User assigned successfully");
      setSelectedUserId("");
      refetchAssignments();
    } catch (err) {
      toast.error("Failed to assign user");
    }
  };

  const handleRemove = async (userId: number) => {
    try {
      await removeMutation.mutateAsync({
        projectId: id,
        userId: userId
      });
      toast.success("User removed successfully");
      refetchAssignments();
    } catch (err) {
      toast.error("Failed to remove user");
    }
  };

  if (isProjectLoading || isAssignmentsLoading || isUsersLoading) {
    return <AppLayout>Loading...</AppLayout>;
  }

  if (!project) {
    return <AppLayout>Project not found</AppLayout>;
  }

  const unassignedUsers = allUsers?.filter(u =>
    !assignments?.some(a => a.userId === u.id)
  ) || [];

  const isAdmin = currentUser?.role === "ADMIN";
  const currentUserAssignment = assignments?.find(a => a.userId === currentUser?.id);
  const isTestLead = currentUserAssignment?.role === "TEST_LEAD";

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Project
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Manage Users: ${project.name}`}
        description="Assign users to this project with role-based permissions."
      />

      <div className="grid gap-6 md:grid-cols-[1fr_350px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assigned Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignments?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users assigned yet.
                </div>
              ) : (
                assignments?.map((assignment) => (
                  <div key={assignment.id} className={`flex items-center justify-between p-3 border rounded-lg ${assignment.user?.isActive === false ? "opacity-60 bg-red-50/30 border-red-200" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {assignment.user?.name}
                          {assignment.user?.isActive === false && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-red-600 font-semibold uppercase tracking-wider">
                              <Ban className="w-3 h-3" /> Suspended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{assignment.user?.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadgeClass(assignment.role)}`}>
                        {roleLabel(assignment.role)}
                      </span>
                      {assignment.role === "DEVELOPER" && (
                        <Link href={`/projects/${id}/bugs?developerId=${assignment.userId}`}>
                          <Button variant="ghost" size="icon" className="w-8 h-8" title="View assigned bugs">
                            <Bug className="w-4 h-4" />
                          </Button>
                        </Link>
                      )}
                      {!isSignedOff && (isAdmin || (isTestLead && assignment.userId !== currentUser?.id)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmRemoveUserId(assignment.userId)}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {!isSignedOff && canManageUsers && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Add User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select User</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedUsers.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()} className={user.isActive === false ? "text-red-600" : ""}>
                        {user.name} ({user.username}){user.isActive === false ? " — Suspended" : ""}
                      </SelectItem>
                    ))}
                    {unassignedUsers.length === 0 && (
                      <div className="p-2 text-center text-xs text-muted-foreground">
                        No more users available
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assign Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={handleAssign}
                disabled={!selectedUserId || assignMutation.isPending}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign to Project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmRemoveUserId !== null} onOpenChange={(open) => { if (!open) setConfirmRemoveUserId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User from Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from the project? This action can be undone by re-assigning them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmRemoveUserId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const id = confirmRemoveUserId; setConfirmRemoveUserId(null); if (id !== null) handleRemove(id); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

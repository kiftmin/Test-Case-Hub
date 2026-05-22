import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, Trash2, User as UserIcon, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import { roleBadgeClass, roleLabel } from "@/lib/role-utils";
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

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

interface UserFormData {
  username: string;
  password: string;
  name: string;
  email: string;
  role: string;
}

const emptyForm: UserFormData = { username: "", password: "", name: "", email: "", role: "USER" };

export default function UserManagement() {
  const queryClient = useQueryClient();
  const currentUser = getAuthUser();
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [isOpen, setIsOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<{ id: number; username: string; isActive: boolean } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);

  const isEditing = editUserId !== null;

  const openCreate = () => {
    setEditUserId(null);
    setFormData(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (user: { id: number; username: string; name: string; email?: string | null; role: string; isActive: boolean }) => {
    setEditUserId(user.id);
    setEditUser({ id: user.id, username: user.username, isActive: user.isActive });
    setFormData({ username: user.username, password: "", name: user.name, email: user.email ?? "", role: user.role });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const updateData: Record<string, any> = { name: formData.name, email: formData.email || null, role: formData.role as any };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await updateUser.mutateAsync({
          userId: editUserId!,
          data: updateData,
        });
        toast.success("User updated successfully");
      } else {
        await createUser.mutateAsync({
          data: { ...formData, role: formData.role as any },
        });
        toast.success("User created successfully");
      }
      setIsOpen(false);
      setEditUserId(null);
      setEditUser(null);
      setFormData(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err) {
      toast.error(isEditing ? "Failed to update user" : "Failed to create user");
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      await deleteUser.mutateAsync({ userId: deleteUserId });
      toast.success("User deleted successfully");
      setDeleteUserId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err) {
      toast.error("Failed to delete user");
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    }
  };

  const handleSuspendToggle = async (userId: number, currentlyActive: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/suspend`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user status");
      }
      toast.success(currentlyActive ? "User suspended" : "User unsuspended");
      if (editUser) {
        setEditUser({ ...editUser, isActive: !currentlyActive });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user status");
    }
  };

  const isSystemAdmin = (user: { username: string }) => user.username === "admin";

  return (
    <AppLayout>
      <PageHeader
        title="User Management"
        description="Manage system users and their roles."
        actions={
          <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setEditUserId(null); setEditUser(null); setFormData(emptyForm); } setIsOpen(open); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit User" : "Add New User"}</DialogTitle>
                <DialogDescription>
                  {isEditing ? "Update user details and role." : "Create a new account for a tester or administrator."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">Username</Label>
                  <Input id="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="col-span-3" required disabled={isEditing} />
                </div>
                {!isEditing && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">Password</Label>
                    <Input id="password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="col-span-3" required />
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Full Name</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">Role</Label>
                  <Select value={formData.role} onValueChange={val => setFormData({ ...formData, role: val })}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                      <SelectItem value="USER">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isEditing && editUser && (
                  <>
                    <div className="border-t pt-4">
                      <div className="grid grid-cols-4 items-center gap-4 mb-3">
                        <Label className="text-right">Status</Label>
                        <div className="col-span-3 flex items-center gap-3">
                          {editUser.isActive ? (
                            <span className="inline-flex items-center gap-1 text-sm text-green-700"><CheckCircle className="w-4 h-4" /> Active</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm text-red-700"><Ban className="w-4 h-4" /> Suspended</span>
                          )}
                          {!isSystemAdmin({ username: editUser.username }) && (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleSuspendToggle(editUser.id, editUser.isActive)}>
                              {editUser.isActive ? "Suspend User" : "Unsuspend User"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-password" className="text-right">New Password</Label>
                        <Input id="edit-password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="col-span-3" placeholder="Leave blank to keep current" />
                      </div>
                    </div>
                  </>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
                    {createUser.isPending || updateUser.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>A list of all users who have access to the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-10 bg-muted animate-pulse rounded"></div>
              <div className="h-10 bg-muted animate-pulse rounded"></div>
              <div className="h-10 bg-muted animate-pulse rounded"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Created At</TableHead>
                  {currentUser?.role === "ADMIN" && <TableHead className="w-32">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => {
                  const isSysAdmin = isSystemAdmin(user);
                  return (
                    <TableRow key={user.id} className={!user.isActive ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{user.username}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadgeClass(user.role)}`}>
                          {roleLabel(user.role)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700">
                            <Ban className="w-3 h-3" /> Suspended
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      {currentUser?.role === "ADMIN" && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(user)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {!isSysAdmin && (
                              <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteUserId(user.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteUserId !== null} onOpenChange={(open) => { if (!open) setDeleteUserId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              Users assigned to projects cannot be deleted — suspend them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteUserId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}

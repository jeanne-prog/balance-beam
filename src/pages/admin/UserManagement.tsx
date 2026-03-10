import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, ShieldAlert, Eye, UserPlus, Trash2, Mail } from "lucide-react";
import type { Role } from "@/types";

interface UserWithRole {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  role: Role;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  used_at: string | null;
}

const roleIcons: Record<Role, typeof Shield> = {
  admin: ShieldAlert,
  editor: Shield,
  viewer: Eye,
};

const roleBadgeVariant: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  editor: "secondary",
  viewer: "outline",
};

const UserManagement = () => {
  const { role: currentRole, user: currentUser } = useAuthContext();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviting, setInviting] = useState(false);

  const isAdmin = currentRole === "admin";

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    if (profiles && roles) {
      const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role as Role]));
      const mapped: UserWithRole[] = profiles.map((p: any) => ({
        userId: p.id,
        email: p.email ?? "",
        fullName: p.full_name ?? "",
        avatarUrl: p.avatar_url ?? "",
        role: roleMap.get(p.id) ?? "viewer",
      }));
      mapped.sort((a, b) => {
        const order: Record<Role, number> = { admin: 0, editor: 1, viewer: 2 };
        return order[a.role] - order[b.role];
      });
      setUsers(mapped);
    }
    setLoading(false);
  };

  const fetchInvitations = async () => {
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .is("used_at", null)
      .order("created_at", { ascending: false });
    if (data) setInvitations(data as Invitation[]);
  };

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update role: " + error.message);
    } else {
      toast.success("Role updated");
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, role: newRole } : u))
      );
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from the app? This will permanently delete their account.`)) return;

    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { userId },
    });

    if (error || data?.error) {
      toast.error("Failed to remove user: " + (data?.error || error?.message));
    } else {
      toast.success(`${email} has been removed`);
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setInviting(true);
    const { error } = await supabase.from("invitations").insert({
      email,
      role: inviteRole,
      invited_by: currentUser?.id,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("An invitation for this email already exists");
      } else {
        toast.error("Failed to invite: " + error.message);
      }
    } else {
      toast.success(`Invited ${email} as ${inviteRole}`);
      setInviteEmail("");
      setInviteRole("viewer");
      fetchInvitations();
    }
    setInviting(false);
  };

  const handleDeleteInvitation = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete invitation");
    } else {
      setInvitations((prev) => prev.filter((i) => i.id !== id));
      toast.success("Invitation removed");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You need admin access to manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Invite section */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Invite a team member</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Pre-assign a role before they sign in with Google. When they log in, they'll automatically get the assigned role.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="max-w-xs h-8 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            <Mail className="w-3.5 h-3.5 mr-1" />
            Invite
          </Button>
        </div>

        {invitations.length > 0 && (
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Pending invitations</p>
            {invitations.map((inv) => {
              const Icon = roleIcons[inv.role];
              return (
                <div key={inv.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{inv.email}</span>
                    <Badge variant={roleBadgeVariant[inv.role]} className="gap-1 text-xs">
                      <Icon className="w-3 h-3" />
                      {inv.role}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDeleteInvitation(inv.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Existing users */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage team roles. The first user to sign in gets admin access automatically.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[180px]">Change Role</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                   <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const Icon = roleIcons[u.role];
                  const isSelf = u.userId === currentUser?.id;
                  return (
                    <TableRow key={u.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {(u.fullName || u.email || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium">
                            {u.fullName || "—"}
                            {isSelf && <span className="text-muted-foreground ml-1">(you)</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant[u.role]} className="gap-1">
                          <Icon className="w-3 h-3" />
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">Can't change own role</span>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleRoleChange(u.userId, v as Role)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;

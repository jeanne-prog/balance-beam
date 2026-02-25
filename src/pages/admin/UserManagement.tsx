import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, ShieldAlert, Eye } from "lucide-react";
import type { Role } from "@/types";

interface UserWithRole {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  role: Role;
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
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchUsers();
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

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You need admin access to manage users.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
  );
};

export default UserManagement;

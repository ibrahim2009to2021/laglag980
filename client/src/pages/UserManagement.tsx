import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";

export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'Viewer'
  });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["/api/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const response = await apiRequest("PUT", `/api/users/${id}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest("POST", "/api/users", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddUserOpen(false);
      setNewUser({ email: '', firstName: '', lastName: '', role: 'Viewer' });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/users/${id}/status`, { isActive });
      return response.json();
    },
    onSuccess: (_, { isActive }) => {
      toast({
        title: "Success",
        description: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) === 1 ? '' : 's'} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) === 1 ? '' : 's'} ago`;
  };

  const getUserInitials = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || 'U';
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      Admin: "bg-primary/10 text-primary",
      Manager: "bg-accent/10 text-accent",
      Staff: "bg-blue-100 text-blue-600",
      Viewer: "bg-gray-100 text-gray-600"
    };
    return <Badge className={colors[role as keyof typeof colors] || colors.Viewer}>{role}</Badge>;
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-accent/10 text-accent">Active</Badge>
    ) : (
      <Badge variant="destructive">Inactive</Badge>
    );
  };

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="text-center py-16">
        <i className="fas fa-shield-alt text-muted-foreground text-6xl mb-4"></i>
        <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
        <p className="text-muted-foreground">You need Admin privileges to access user management.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <i className="fas fa-exclamation-circle text-destructive text-4xl mb-4"></i>
        <p className="text-sm text-muted-foreground">Failed to load users</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* User Management Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">User Management</h3>
          <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <i className="fas fa-user-plus mr-2"></i>
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  data-testid="input-user-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  data-testid="input-user-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  data-testid="input-user-lastname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUser.role} onValueChange={(role) => setNewUser({ ...newUser, role })}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddUserOpen(false);
                    setNewUser({ email: '', firstName: '', lastName: '', role: 'Viewer' });
                  }}
                  data-testid="button-cancel-add-user"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createUserMutation.mutate(newUser)}
                  disabled={!newUser.email || createUserMutation.isPending}
                  data-testid="button-create-user"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <div className="ml-3">
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : users?.length ? (
                  users.map((user: any) => (
                    <tr key={user.id} data-testid={`row-user-${user.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-foreground">
                              {getUserInitials(user)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-foreground">
                              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Select
                          value={user.role}
                          onValueChange={(role) => updateRoleMutation.mutate({ id: user.id, role })}
                          disabled={user.id === currentUser?.id || updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Staff">Staff</SelectItem>
                            <SelectItem value="Viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.isActive)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {formatTimeAgo(user.lastLoginAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          data-testid={`button-edit-${user.id}`}
                        >
                          <i className="fas fa-edit w-4 h-4"></i>
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="icon"
                          data-testid={`button-reset-password-${user.id}`}
                        >
                          <i className="fas fa-key w-4 h-4"></i>
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateStatusMutation.mutate({ 
                            id: user.id, 
                            isActive: !user.isActive 
                          })}
                          disabled={user.id === currentUser?.id || updateStatusMutation.isPending}
                          className={user.isActive ? "text-destructive hover:text-destructive" : "text-accent hover:text-accent"}
                          data-testid={`button-toggle-status-${user.id}`}
                        >
                          <i className={`fas ${user.isActive ? 'fa-user-slash' : 'fa-user-check'} w-4 h-4`}></i>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="space-y-4">
                        <i className="fas fa-users text-muted-foreground text-4xl"></i>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">No users found</h3>
                          <p className="text-muted-foreground">Users will appear here once they sign in</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Admin</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Full system access</li>
              <li>• User management</li>
              <li>• Invoice approval</li>
              <li>• All product operations</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Manager</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Product management</li>
              <li>• Invoice creation</li>
              <li>• Limited user access</li>
              <li>• Activity monitoring</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Staff</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Product viewing</li>
              <li>• Invoice creation</li>
              <li>• Limited editing</li>
              <li>• Basic operations</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Viewer</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Read-only access</li>
              <li>• Product viewing</li>
              <li>• Report access</li>
              <li>• No editing rights</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

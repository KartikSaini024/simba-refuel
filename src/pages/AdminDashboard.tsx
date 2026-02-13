import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Plus, Trash2, ExternalLink, Users, Building2, BarChart3, Image, Settings, MoreHorizontal, Pencil } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LoadingSpinner, InlineLoader } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { handleError } from '@/utils/errorHandling';
import { Profile, Branch } from '@/types/database';
import { RefuelStatistics } from '@/components/RefuelStatistics';
import RefuelRecordSearch from '@/components/RefuelRecordSearch';
import { UserBranchManagement } from '@/components/UserBranchManagement';
import { AdminRefuelViewer } from '@/components/AdminRefuelViewer'; // Import the new component
import { format } from 'date-fns';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthContext();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState({ code: '', name: '', location: '' });
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedUserForBranchManagement, setSelectedUserForBranchManagement] = useState<Profile | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState({
    pendingUsers: true,
    allUsers: true,
    branches: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingUsers();
    fetchAllUsers();
    fetchBranches();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setLoading(prev => ({ ...prev, pendingUsers: true }));
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          branches (*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingUsers((data || []) as Profile[]);
    } catch (error) {
      handleError(error, 'Failed to fetch pending users');
    } finally {
      setLoading(prev => ({ ...prev, pendingUsers: false }));
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(prev => ({ ...prev, allUsers: true }));
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          branches (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllUsers((data || []) as Profile[]);
    } catch (error) {
      handleError(error, 'Failed to fetch users');
    } finally {
      setLoading(prev => ({ ...prev, allUsers: false }));
    }
  };

  const fetchBranches = async () => {
    try {
      setLoading(prev => ({ ...prev, branches: true }));
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (error) throw error;
      setBranches((data || []).map((b: any) => ({
        ...b,
        location: b.location ?? '',
        is_active: b.is_active ?? false,
        created_at: b.created_at ?? '',
        updated_at: b.updated_at ?? ''
      })));
    } catch (error) {
      handleError(error, 'Failed to fetch branches');
    } finally {
      setLoading(prev => ({ ...prev, branches: false }));
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved' })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "User approved",
        description: "User has been approved and can now access the system.",
      });

      fetchPendingUsers();
      fetchAllUsers();
    } catch (error) {
      handleError(error, 'Failed to approve user');
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'rejected' })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "User rejected",
        description: "User has been rejected.",
      });

      fetchPendingUsers();
      fetchAllUsers();
    } catch (error) {
      handleError(error, 'Failed to reject user');
    }
  };

  const createBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('branches')
        .insert([newBranch]);

      if (error) throw error;

      toast({
        title: "Branch created",
        description: `Branch ${newBranch.code} has been created successfully.`,
      });

      setNewBranch({ code: '', name: '', location: '' });
      fetchBranches();
    } catch (error) {
      handleError(error, 'Failed to create branch');
    }
  };

  const deleteBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch? This will also remove all associated data.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);

      if (error) throw error;

      toast({
        title: "Branch deleted",
        description: "Branch has been deleted successfully.",
      });

      fetchBranches();
      fetchAllUsers();
    } catch (error) {
      handleError(error, 'Failed to delete branch');
    }
  };

  const updateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    try {
      const { error } = await supabase
        .from('branches')
        .update({
          code: editingBranch.code,
          name: editingBranch.name,
          location: editingBranch.location
        })
        .eq('id', editingBranch.id);

      if (error) throw error;

      toast({
        title: "Branch updated",
        description: "Branch details have been updated successfully.",
      });

      setEditingBranch(null);
      fetchBranches();
    } catch (error) {
      handleError(error, 'Failed to update branch');
    }
  };

  const updateUserRole = async (userId: string, newRole: 'staff' | 'admin') => {
    try {
      const updateData: any = { role: newRole };

      // If promoting to super admin, remove branch assignment
      if (newRole === 'admin') {
        updateData.branch_id = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: `User role has been updated to ${newRole}.`,
      });

      fetchAllUsers();
    } catch (error) {
      handleError(error, 'Failed to update user role');
    }
  };

  const updateUserStatus = async (userId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Status updated",
        description: `User status has been updated to ${newStatus}.`,
      });

      fetchPendingUsers();
      fetchAllUsers();
    } catch (error) {
      handleError(error, 'Failed to update user status');
    }
  };

  const updateUserBranch = async (userId: string, branchId: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: branchId as any })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Branch updated",
        description: "User branch assignment has been updated.",
      });

      fetchAllUsers();
    } catch (error) {
      handleError(error, 'Failed to update user branch');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, branches, and system operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Main
          </Button>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="branches">Branch Management</TabsTrigger>
          <TabsTrigger value="refuel-log">Refuel Log</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="refuel-log" className="space-y-6">
          <RefuelRecordSearch branches={branches} />
          <AdminRefuelViewer branches={branches} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Review and approve new user registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.pendingUsers ? (
                <InlineLoader text="Loading pending approvals..." />
              ) : pendingUsers.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title="No pending approvals"
                  description="All user registrations have been processed."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Requested Role</TableHead>
                      <TableHead>Requested Branch</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.first_name} {user.last_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'destructive' : 'default'}>
                            {user.role === 'admin' ? 'Super Admin' : 'Staff'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'admin' ? (
                            <Badge variant="secondary">All Branches</Badge>
                          ) : (
                            user.branches ? `${user.branches.code} - ${user.branches.name}` : 'No branch'
                          )}
                        </TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveUser(user.user_id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectUser(user.user_id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage existing users, their roles and branch assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.allUsers ? (
                <InlineLoader text="Loading users..." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.first_name} {user.last_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value: 'staff' | 'admin') => updateUserRole(user.user_id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {user.role === 'admin' && !user.branch_id ? (
                            <Badge variant="secondary">All Branches</Badge>
                          ) : (
                            <Select
                              value={user.branch_id || 'NONE'}
                              onValueChange={(value) => updateUserBranch(user.user_id, value === 'NONE' ? null : value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">No branch</SelectItem>
                                {branches.map((branch) => (
                                  <SelectItem key={branch.id} value={branch.id}>
                                    {branch.code} - {branch.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.status}
                            onValueChange={(value: 'pending' | 'approved' | 'rejected') => updateUserStatus(user.user_id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUserForBranchManagement(user)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Manage Branches
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Branch</CardTitle>
              <CardDescription>Add a new branch to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createBranch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Branch Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., MEL"
                    value={newBranch.code}
                    onChange={(e) => setNewBranch(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Branch Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Melbourne"
                    value={newBranch.name}
                    onChange={(e) => setNewBranch(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Melbourne Airport"
                    value={newBranch.location}
                    onChange={(e) => setNewBranch(prev => ({ ...prev, location: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Branch
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Branches</CardTitle>
              <CardDescription>Manage branch locations and settings</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.branches ? (
                <InlineLoader text="Loading branches..." />
              ) : branches.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-6 w-6" />}
                  title="No branches found"
                  description="Create your first branch to get started."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-mono">{branch.code}</TableCell>
                        <TableCell>{branch.name}</TableCell>
                        <TableCell>{branch.location}</TableCell>
                        <TableCell className="space-x-2">
                          <div className="flex items-center gap-2">
                            <Link to={`/?branch=${branch.id}`} target="_blank">
                              <Button size="sm" variant="outline">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Open
                              </Button>
                            </Link>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setEditingBranch(branch)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => deleteBranch(branch.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Branch
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>


        </TabsContent>

        <TabsContent value="statistics">
          <RefuelStatistics branches={branches} />
        </TabsContent>
      </Tabs>

      {/* User Branch Management Dialog */}
      <Dialog open={!!selectedUserForBranchManagement} onOpenChange={() => setSelectedUserForBranchManagement(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Branch Access Management
            </DialogTitle>
          </DialogHeader>
          {selectedUserForBranchManagement && (
            <UserBranchManagement
              userId={selectedUserForBranchManagement.user_id}
              userEmail={selectedUserForBranchManagement.email}
              onClose={() => setSelectedUserForBranchManagement(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
          </DialogHeader>
          {editingBranch && (
            <form onSubmit={updateBranch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Branch Code</Label>
                <Input
                  id="edit-code"
                  value={editingBranch.code}
                  onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Branch Name</Label>
                <Input
                  id="edit-name"
                  value={editingBranch.name}
                  onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editingBranch.location || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, location: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingBranch(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default AdminDashboard;
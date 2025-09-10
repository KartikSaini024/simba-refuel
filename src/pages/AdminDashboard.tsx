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
import { CheckCircle, XCircle, Plus, Trash2, ExternalLink, Users, Building2, BarChart3, Image } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LoadingSpinner, InlineLoader } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { handleError } from '@/utils/errorHandling';
import { Profile, Branch } from '@/types/database';
import { RefuelStatistics } from '@/components/RefuelStatistics';
import RefuelRecordSearch from '@/components/RefuelRecordSearch';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthContext();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState({ code: '', name: '', location: '' });
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
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
      setBranches(data || []);
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
        .update({ branch_id: branchId })
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
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="refuel">Branch Operations</TabsTrigger>
        </TabsList>

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
                          <div className="text-xs text-muted-foreground">
                            Use status dropdown to manage user access
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
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-mono">{branch.code}</TableCell>
                        <TableCell>{branch.name}</TableCell>
                        <TableCell>{branch.location}</TableCell>
                        <TableCell>
                          <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                            {branch.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteBranch(branch.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
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

        <TabsContent value="refuel" className="space-y-6">
          <RefuelRecordSearch branches={branches} />
          
          <Card>
            <CardHeader>
              <CardTitle>Branch Operations</CardTitle>
              <CardDescription>Access branch-specific refuel management systems</CardDescription>
            </CardHeader>
            <CardContent>
              {branches.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 className="h-6 w-6" />}
                  title="No branches available"
                  description="Create branches first to access their operations."
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {branches.map((branch) => (
                    <Card key={branch.id} className="hover:shadow-md transition-shadow duration-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{branch.code}</CardTitle>
                        <CardDescription>{branch.name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">{branch.location}</p>
                        <Link to={`/?branch=${branch.id}`}>
                          <Button className="w-full" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Branch Dashboard
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <RefuelStatistics branches={branches} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
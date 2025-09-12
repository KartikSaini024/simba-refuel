import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { useUserBranches, Branch, UserBranchAccess } from '@/hooks/useUserBranches';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UserBranchManagementProps {
  userId: string;
  userEmail: string;
  onClose?: () => void;
}

export const UserBranchManagement = ({ userId, userEmail, onClose }: UserBranchManagementProps) => {
  const { allBranches, userBranchAccess, addBranchAccess, removeBranchAccess, fetchUserBranchAccess } = useUserBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load user's branch access when component mounts
  React.useEffect(() => {
    fetchUserBranchAccess(userId);
  }, [userId, fetchUserBranchAccess]);

  const handleAddBranchAccess = async () => {
    if (!selectedBranchId) return;
    
    setLoading(true);
    const success = await addBranchAccess(userId, selectedBranchId);
    if (success) {
      setSelectedBranchId('');
    }
    setLoading(false);
  };

  const handleRemoveBranchAccess = async (accessId: string) => {
    setLoading(true);
    await removeBranchAccess(accessId, userId);
    setLoading(false);
  };

  // Get branches that the user doesn't already have access to
  const availableBranches = allBranches.filter(branch => 
    !userBranchAccess.some(access => access.branch_id === branch.id)
  );

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Branch Access Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Managing branch access for: <strong>{userEmail}</strong>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new branch access */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Add Branch Access</h3>
          <div className="flex gap-2">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a branch to add" />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddBranchAccess}
              disabled={!selectedBranchId || loading}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Access
            </Button>
          </div>
          {availableBranches.length === 0 && (
            <p className="text-sm text-muted-foreground">
              User already has access to all available branches.
            </p>
          )}
        </div>

        {/* Current branch access */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Current Branch Access</h3>
          {userBranchAccess.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No additional branch access granted. User can only access their primary branch.
            </p>
          ) : (
            <div className="space-y-2">
              {userBranchAccess.map((access) => (
                <div key={access.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {access.branch?.code} - {access.branch?.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(access.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Branch Access</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove access to "{access.branch?.name}" for this user? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveBranchAccess(access.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Remove Access
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        {onClose && (
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
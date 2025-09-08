import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
}

interface BranchSelectorProps {
  selectedBranchId: string | null;
  onBranchChange: (branchId: string) => void;
  className?: string;
}

const BranchSelector: React.FC<BranchSelectorProps> = ({ 
  selectedBranchId, 
  onBranchChange, 
  className 
}) => {
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuthContext();

  useEffect(() => {
    if (profile) {
      fetchUserBranches();
    }
  }, [profile]);

  const fetchUserBranches = async () => {
    try {
      if (profile?.role === 'admin' && !profile?.branch_id) {
        // Super admin can access all branches (branch_id is null)
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setUserBranches(data || []);
      } else if (profile?.branch_id) {
        // Staff can only access their assigned branch
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', profile.branch_id)
          .eq('is_active', true);

        if (error) throw error;
        setUserBranches(data || []);
        
        // Auto-select the user's branch if not already selected
        if (data && data.length > 0 && !selectedBranchId) {
          onBranchChange(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching user branches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading branches..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (userBranches.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="No branches available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={selectedBranchId || ''} onValueChange={onBranchChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {userBranches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.code} - {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default BranchSelector;
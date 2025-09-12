import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  is_active: boolean;
}

export interface UserBranchAccess {
  id: string;
  user_id: string;
  branch_id: string;
  created_at: string;
  branch?: Branch;
}

export const useUserBranches = () => {
  const [accessibleBranches, setAccessibleBranches] = useState<Branch[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [userBranchAccess, setUserBranchAccess] = useState<UserBranchAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuthContext();

  // Fetch all branches (for admin use)
  const fetchAllBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAllBranches(data || []);
    } catch (error) {
      console.error('Error fetching all branches:', error);
    }
  };

  // Fetch user's accessible branches
  const fetchAccessibleBranches = async () => {
    if (!profile) return;

    try {
      if (profile.role === 'admin' && !profile.branch_id) {
        // Super admin can access all branches
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setAccessibleBranches(data || []);
      } else if (profile.branch_id) {
        // For now, users can only access their primary branch until the new table is created
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', profile.branch_id)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setAccessibleBranches(data || []);
      } else {
        setAccessibleBranches([]);
      }
    } catch (error) {
      console.error('Error fetching accessible branches:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load accessible branches.",
      });
    }
  };

  // Fetch user's branch access records (for admin management)
  const fetchUserBranchAccess = async (userId?: string) => {
    if (profile?.role !== 'admin') return;

    // For now, return empty array until the new table is created
    setUserBranchAccess([]);
  };

  // Add branch access for a user
  const addBranchAccess = async (userId: string, branchId: string) => {
    // For now, return false until the new table is created
    toast({
      variant: "destructive",
      title: "Feature Coming Soon",
      description: "Multiple branch access will be available after database migration.",
    });
    return false;
  };

  // Remove branch access for a user
  const removeBranchAccess = async (accessId: string, userId?: string) => {
    // For now, return false until the new table is created
    toast({
      variant: "destructive",
      title: "Feature Coming Soon",
      description: "Multiple branch access will be available after database migration.",
    });
    return false;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAccessibleBranches(),
        profile?.role === 'admin' ? fetchAllBranches() : Promise.resolve()
      ]);
      setLoading(false);
    };

    if (profile) {
      loadData();
    }
  }, [profile]);

  return {
    accessibleBranches,
    allBranches,
    userBranchAccess,
    loading,
    fetchUserBranchAccess,
    addBranchAccess,
    removeBranchAccess,
    refreshAccessibleBranches: fetchAccessibleBranches
  };
};
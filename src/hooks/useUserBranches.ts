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
      setAllBranches((data || []).map(b => ({
        ...b,
        location: b.location ?? '',
        is_active: b.is_active ?? false,
        created_at: b.created_at ?? '',
        updated_at: b.updated_at ?? ''
      })));
    } catch (error) {
      console.error('Error fetching all branches:', error);
    }
  };

  // Fetch user's accessible branches
  const fetchAccessibleBranches = async () => {
    if (!profile) return;

    try {
      // Super admin can access all branches if no primary branch is set
      if (profile.role === 'admin' && !profile.branch_id) {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setAccessibleBranches((data || []).map(b => ({
          ...b,
          location: b.location ?? '',
          is_active: b.is_active ?? false,
          created_at: b.created_at ?? '',
          updated_at: b.updated_at ?? ''
        })));
        return;
      }

      // Collect branch ids from user_branch_access + include primary branch if present
      const userId = profile.user_id;

      let accessRows: { branch_id: string }[] | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('user_branch_access')
          .select('branch_id')
          .eq('user_id', userId);
        if (error) throw error;
        accessRows = data || [];
      } catch (err) {
        console.warn('user_branch_access lookup failed or table missing, falling back to primary branch only:', err);
        accessRows = [];
      }

      const branchIds = new Set<string>();
      if (profile.branch_id) branchIds.add(profile.branch_id);
      (accessRows || []).forEach((r) => r?.branch_id && branchIds.add(r.branch_id));

      if (branchIds.size === 0) {
        setAccessibleBranches([]);
        return;
      }

      const { data: branches, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .in('id', Array.from(branchIds) as string[])
        .eq('is_active', true)
        .order('name');

      if (branchesError) throw branchesError;
      setAccessibleBranches((branches || []).map(b => ({
        ...b,
        location: b.location ?? '',
        is_active: b.is_active ?? false,
        created_at: b.created_at ?? '',
        updated_at: b.updated_at ?? ''
      })));
    } catch (error) {
      console.error('Error fetching accessible branches:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load accessible branches.",
      });
    }
  };

  const fetchUserBranchAccess = async (userId?: string) => {
    if (profile?.role !== 'admin') return;
    try {
      const targetUserId = userId || profile.user_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: accessRows, error } = await (supabase as any)
        .from('user_branch_access')
        .select('id, user_id, branch_id, created_at')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const ids = Array.from(new Set((accessRows || []).map((r: any) => r.branch_id).filter(Boolean))) as string[];
      let branchesById: Record<string, Branch> = {};
      if (ids.length) {
        const { data: branches, error: bErr } = await supabase
          .from('branches')
          .select('*')
          .in('id', ids as string[]);
        if (bErr) throw bErr;
        branchesById = Object.fromEntries((branches || []).map((b: any) => [b.id, b]));
      }

      setUserBranchAccess(
        (accessRows || []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          branch_id: r.branch_id,
          created_at: r.created_at,
          branch: branchesById[r.branch_id],
        }))
      );
    } catch (error) {
      console.error('Error fetching user branch access:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load user branch access.',
      });
    }
  };

  const addBranchAccess = async (userId: string, branchId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('user_branch_access')
        .insert([{ user_id: userId, branch_id: branchId }])
        .select()
        .single();
      if (error) throw error;

      toast({ title: 'Access added', description: 'User can now access the branch.' });
      await fetchUserBranchAccess(userId);
      await fetchAccessibleBranches();
      return true;
    } catch (error: any) {
      console.error('Error adding branch access:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to add access',
        description: error?.message || 'Please check RLS policies.',
      });
      return false;
    }
  };

  const removeBranchAccess = async (accessId: string, userId?: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('user_branch_access')
        .delete()
        .eq('id', accessId);
      if (error) throw error;

      toast({ title: 'Access removed' });
      if (userId) await fetchUserBranchAccess(userId);
      await fetchAccessibleBranches();
      return true;
    } catch (error: any) {
      console.error('Error removing branch access:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to remove access',
        description: error?.message || 'Please check RLS policies.',
      });
      return false;
    }
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
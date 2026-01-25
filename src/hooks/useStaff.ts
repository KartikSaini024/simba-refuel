import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Staff } from '@/types/refuel';
import { toast } from '@/hooks/use-toast';

export const useStaff = (branchId?: string) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStaff = async () => {
    if (!branchId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('branch_id', branchId)
        .order('name');

      if (error) throw error;

      const formattedStaff = data.map(item => ({
        id: item.id,
        name: item.name
      }));

      setStaff(formattedStaff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to load staff members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addStaff = async (name: string) => {
    if (!branchId) return;

    try {
      const { data, error } = await supabase
        .from('staff')
        .insert({ name, branch_id: branchId })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Error',
            description: 'This staff member already exists in this branch',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      const newStaff = { id: data.id, name: data.name };
      setStaff(prev => [...prev, newStaff]);

      toast({
        title: 'Success',
        description: 'Staff member added successfully',
      });
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to add staff member',
        variant: 'destructive',
      });
    }
  };

  const removeStaff = async (id: string) => {
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setStaff(prev => prev.filter(s => s.id !== id));

      toast({
        title: 'Success',
        description: 'Staff member removed successfully',
      });
    } catch (error) {
      console.error('Error removing staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove staff member',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [branchId]);

  return {
    staff,
    loading,
    addStaff,
    removeStaff,
    refetch: fetchStaff
  };
};
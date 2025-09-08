import { supabase } from '@/integrations/supabase/client';

export const useActivityLog = () => {
  const logActivity = async (
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any,
    branchId?: string
  ) => {
    try {
      const { error } = await supabase.rpc('log_activity' as any, {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_details: details ? JSON.stringify(details) : null,
        p_branch_id: branchId
      });

      if (error) {
        console.error('Error logging activity:', error);
      }
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  return { logActivity };
};
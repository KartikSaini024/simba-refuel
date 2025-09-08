-- Create function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    branch_id
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    COALESCE(p_branch_id, get_user_branch_id())
  )
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;
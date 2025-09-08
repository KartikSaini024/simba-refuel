-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  requested_branch_code text;
  branch_uuid uuid;
BEGIN
  -- Get requested branch from metadata
  requested_branch_code := NEW.raw_user_meta_data ->> 'branch_code';
  
  -- Get branch ID if branch code provided
  IF requested_branch_code IS NOT NULL THEN
    SELECT id INTO branch_uuid 
    FROM public.branches 
    WHERE code = requested_branch_code 
    LIMIT 1;
  END IF;
  
  -- Insert profile
  INSERT INTO public.profiles (user_id, email, first_name, last_name, branch_id, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    branch_uuid,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff'),
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'role' = 'admin' THEN 'approved'
      ELSE 'pending'
    END
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
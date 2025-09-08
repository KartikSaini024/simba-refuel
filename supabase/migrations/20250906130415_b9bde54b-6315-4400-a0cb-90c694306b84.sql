-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update user profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own branch assignments" ON public.user_branches;
DROP POLICY IF EXISTS "Admins can manage user branch assignments" ON public.user_branches;
DROP POLICY IF EXISTS "Users can view records from their assigned branches" ON public.refuel_records;
DROP POLICY IF EXISTS "Users can create records in their assigned branches" ON public.refuel_records;
DROP POLICY IF EXISTS "Users can update records they created in their branches" ON public.refuel_records;
DROP POLICY IF EXISTS "Users can delete records they created in their branches" ON public.refuel_records;

-- Drop the user_branches table since we're simplifying to one branch per user
DROP TABLE IF EXISTS public.user_branches;

-- Add branch_id directly to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Update refuel_records to reference profiles instead of user_branches
ALTER TABLE public.refuel_records DROP CONSTRAINT IF EXISTS refuel_records_created_by_fkey;
ALTER TABLE public.refuel_records ADD CONSTRAINT refuel_records_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'approved'
      AND branch_id IS NULL  -- Super admin has no specific branch
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Simple RLS policies using security definer functions
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Super admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "Allow profile creation during signup" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for refuel_records
CREATE POLICY "Users can view their branch records" ON public.refuel_records
  FOR SELECT USING (
    branch_id = public.get_user_branch_id() OR public.is_super_admin()
  );

CREATE POLICY "Users can create records in their branch" ON public.refuel_records
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND 
    (branch_id = public.get_user_branch_id() OR public.is_super_admin())
  );

CREATE POLICY "Users can update their own records" ON public.refuel_records
  FOR UPDATE USING (
    created_by = auth.uid() AND 
    (branch_id = public.get_user_branch_id() OR public.is_super_admin())
  );

CREATE POLICY "Users can delete their own records" ON public.refuel_records
  FOR DELETE USING (
    created_by = auth.uid() AND 
    (branch_id = public.get_user_branch_id() OR public.is_super_admin())
  );

-- Update the handle_new_user function to handle branch assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  INSERT INTO public.profiles (user_id, email, first_name, last_name, branch_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    branch_uuid,  -- Will be NULL for super admin
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff')
  );
  
  RETURN NEW;
END;
$$;
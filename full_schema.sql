-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_branches junction table
CREATE TABLE public.user_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.profiles(user_id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

-- Create refuel_records table (branch-aware version)
CREATE TABLE public.refuel_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  reservation_number TEXT NOT NULL,
  rego TEXT NOT NULL,
  added_to_rcm BOOLEAN NOT NULL DEFAULT false,
  amount DECIMAL(10,2) NOT NULL,
  refuelled_by TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
  );

CREATE POLICY "Admins can update user profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
  );

-- RLS policies for branches
CREATE POLICY "Approved users can view branches" ON public.branches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.status = 'approved'
    )
  );

CREATE POLICY "Admins can manage branches" ON public.branches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
  );

-- RLS policies for user_branches
CREATE POLICY "Users can view their own branch assignments" ON public.user_branches
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
  );

CREATE POLICY "Admins can manage user branch assignments" ON public.user_branches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
  );

-- RLS policies for refuel_records
CREATE POLICY "Users can view records from their assigned branches" ON public.refuel_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_branches ub
      JOIN public.profiles p ON p.user_id = ub.user_id
      WHERE ub.user_id = auth.uid() 
        AND ub.branch_id = refuel_records.branch_id
        AND p.status = 'approved'
    )
  );

CREATE POLICY "Users can create records in their assigned branches" ON public.refuel_records
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_branches ub
      JOIN public.profiles p ON p.user_id = ub.user_id
      WHERE ub.user_id = auth.uid() 
        AND ub.branch_id = refuel_records.branch_id
        AND p.status = 'approved'
    )
  );

CREATE POLICY "Users can update records they created in their branches" ON public.refuel_records
  FOR UPDATE USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_branches ub
      JOIN public.profiles p ON p.user_id = ub.user_id
      WHERE ub.user_id = auth.uid() 
        AND ub.branch_id = refuel_records.branch_id
        AND p.status = 'approved'
    )
  );

CREATE POLICY "Users can delete records they created in their branches" ON public.refuel_records
  FOR DELETE USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_branches ub
      JOIN public.profiles p ON p.user_id = ub.user_id
      WHERE ub.user_id = auth.uid() 
        AND ub.branch_id = refuel_records.branch_id
        AND p.status = 'approved'
    )
  );

-- RLS policies for activity_logs
CREATE POLICY "Users can view their own activity logs" ON public.activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity logs" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
  );

CREATE POLICY "All authenticated users can create activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Insert initial branches
INSERT INTO public.branches (code, name, location) VALUES
  ('SYD', 'Sydney', 'Sydney, Australia'),
  ('BNE', 'Brisbane', 'Brisbane, Australia'),
  ('ADE', 'Adelaide', 'Adelaide, Australia'),
  ('CNE', 'Cairns', 'Cairns, Australia');

-- Create function to handle user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    branch_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    p_branch_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_refuel_records_updated_at
  BEFORE UPDATE ON public.refuel_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Create default admin user (you'll need to sign up first, then run this to promote to admin)
-- UPDATE public.profiles SET role = 'admin', status = 'approved' WHERE email = 'your-email@example.com';
-- Allow public (anonymous) access to view branches for signup
CREATE POLICY "Public can view active branches" ON public.branches
  FOR SELECT USING (is_active = true);

-- Drop the old restrictive policy
DROP POLICY "Approved users can view branches" ON public.branches;
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
-- Drop all existing tables and functions
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.refuel_records CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;

DROP FUNCTION IF EXISTS public.get_current_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_branch_id() CASCADE;
DROP FUNCTION IF EXISTS public.log_activity CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create branches table
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table (simplified)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    branch_id UUID REFERENCES public.branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create refuel_records table
CREATE TABLE public.refuel_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rego TEXT NOT NULL,
    reservation_number TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    refuelled_by TEXT NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    created_by UUID NOT NULL,
    added_to_rcm BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB,
    branch_id UUID REFERENCES public.branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create utility functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_branches_updated_at
    BEFORE UPDATE ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_refuel_records_updated_at
    BEFORE UPDATE ON public.refuel_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create security definer functions
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT branch_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Create auth trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Create auth trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Branches policies (public read for active branches)
CREATE POLICY "Anyone can view active branches" ON public.branches
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage branches" ON public.branches
  FOR ALL USING (public.is_admin());

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- Refuel records policies
CREATE POLICY "Users can view branch refuel records" ON public.refuel_records
  FOR SELECT USING (
    branch_id = public.get_user_branch_id() OR public.is_admin()
  );

CREATE POLICY "Users can create refuel records in their branch" ON public.refuel_records
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND 
    (branch_id = public.get_user_branch_id() OR public.is_admin())
  );

CREATE POLICY "Users can update their own refuel records" ON public.refuel_records
  FOR UPDATE USING (
    created_by = auth.uid() AND 
    (branch_id = public.get_user_branch_id() OR public.is_admin())
  );

CREATE POLICY "Users can delete their own refuel records" ON public.refuel_records
  FOR DELETE USING (
    created_by = auth.uid() AND 
    (branch_id = public.get_user_branch_id() OR public.is_admin())
  );

-- Activity logs policies
CREATE POLICY "Users can view own activity" ON public.activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all activity" ON public.activity_logs
  FOR SELECT USING (public.is_admin());

-- Insert initial branches
INSERT INTO public.branches (code, name, location) VALUES
('SYD01', 'Sydney Airport', 'Sydney, NSW'),
('MEL01', 'Melbourne Airport', 'Melbourne, VIC'),
('BNE01', 'Brisbane Airport', 'Brisbane, QLD'),
('PER01', 'Perth Airport', 'Perth, WA'),
('ADL01', 'Adelaide Airport', 'Adelaide, SA');
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
-- Create missing profile for existing user
INSERT INTO public.profiles (user_id, email, first_name, last_name, branch_id, role, status)
VALUES (
  '6912a260-8473-4a18-936b-ba0033efd3d8'::uuid,
  'kartik@simbacarhire.com.au',
  'Kartik',
  'Saini',
  NULL, -- Admin doesn't need branch_id
  'admin',
  'approved' -- Auto-approve admin
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status;
-- Create trigger for automatic profile creation on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Drop activity_logs table as it's no longer needed
DROP TABLE IF EXISTS public.activity_logs CASCADE;

-- Create staff table linked to branches
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(name, branch_id)
);

-- Enable RLS on staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Create policies for staff table
CREATE POLICY "Users can view staff in their branch" 
ON public.staff 
FOR SELECT 
USING (branch_id = get_user_branch_id() OR is_admin());

CREATE POLICY "Users can create staff in their branch" 
ON public.staff 
FOR INSERT 
WITH CHECK (branch_id = get_user_branch_id() OR is_admin());

CREATE POLICY "Users can update staff in their branch" 
ON public.staff 
FOR UPDATE 
USING (branch_id = get_user_branch_id() OR is_admin());

CREATE POLICY "Users can delete staff in their branch" 
ON public.staff 
FOR DELETE 
USING (branch_id = get_user_branch_id() OR is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_staff_updated_at
    BEFORE UPDATE ON public.staff
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Modify refuel_records to include proper datetime and make it temporary by default
ALTER TABLE public.refuel_records 
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS refuel_datetime TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing records to have proper datetime from created_at
UPDATE public.refuel_records 
SET refuel_datetime = created_at 
WHERE refuel_datetime IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_refuel_records_branch_temp ON public.refuel_records(branch_id, is_temporary);
CREATE INDEX IF NOT EXISTS idx_refuel_records_datetime ON public.refuel_records(refuel_datetime);

-- Remove log_activity function since we're removing activity logs
DROP FUNCTION IF EXISTS public.log_activity(text, text, uuid, jsonb, uuid);
-- Add receipt_photo_url column to refuel_records table
ALTER TABLE public.refuel_records 
ADD COLUMN receipt_photo_url TEXT;

-- Create storage bucket for refuel receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('refuel-receipts', 'refuel-receipts', false);

-- Create policies for refuel receipt uploads
CREATE POLICY "Users can view receipts from their branch or admins can view all" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'refuel-receipts' AND (
  auth.uid()::text = (storage.foldername(name))[1] OR 
  is_admin() OR
  EXISTS (
    SELECT 1 FROM public.refuel_records r 
    WHERE r.receipt_photo_url = storage.objects.name 
    AND (r.branch_id = get_user_branch_id() OR is_admin())
  )
));

CREATE POLICY "Users can upload receipts to their branch or admins can upload to any" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'refuel-receipts' AND (
  auth.uid()::text = (storage.foldername(name))[1] OR 
  is_admin()
));

CREATE POLICY "Users can update their own receipt uploads or admins can update any" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'refuel-receipts' AND (
  auth.uid()::text = (storage.foldername(name))[1] OR 
  is_admin()
));

CREATE POLICY "Users can delete their own receipt uploads or admins can delete any" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'refuel-receipts' AND (
  auth.uid()::text = (storage.foldername(name))[1] OR 
  is_admin()
));

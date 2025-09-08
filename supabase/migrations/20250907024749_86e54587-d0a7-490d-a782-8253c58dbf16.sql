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
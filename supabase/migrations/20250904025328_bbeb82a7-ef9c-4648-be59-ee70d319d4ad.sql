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
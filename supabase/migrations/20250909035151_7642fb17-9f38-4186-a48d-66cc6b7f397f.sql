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
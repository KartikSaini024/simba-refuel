-- Allow public (anonymous) access to view branches for signup
CREATE POLICY "Public can view active branches" ON public.branches
  FOR SELECT USING (is_active = true);

-- Drop the old restrictive policy
DROP POLICY "Approved users can view branches" ON public.branches;
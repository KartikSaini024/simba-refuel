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
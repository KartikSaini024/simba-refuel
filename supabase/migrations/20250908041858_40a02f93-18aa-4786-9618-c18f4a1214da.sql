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
export interface DatabaseRefuelRecord {
  id: string;
  branch_id: string;
  rego: string;
  amount: number;
  refuelled_by: string;
  reservation_number: string;
  added_to_rcm: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  refuel_datetime: string;
  receipt_photo_url?: string;
}

export interface DatabaseStaff {
  id: string;
  name: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'staff' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  branches?: Branch;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  branch_id: string | null;
  resource_type: string;
  action: string;
  created_at: string;
}

export interface RefuelFormData {
  rego: string;
  amount: string;
  refuelled_by: string;
  reservation_number: string;
}

export interface StatsData {
  recordsToday: number;
  totalAmount: number;
  addedToRcm: number;
}

export type UserRole = 'staff' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';
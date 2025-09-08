import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { RefuelForm } from '@/components/RefuelForm';
import { StaffManagement } from '@/components/StaffManagement';
import { RefuelTable } from '@/components/RefuelTable';
import { PDFGenerator } from '@/components/PDFGenerator';
import BranchSelector from '@/components/BranchSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefuelRecord, Staff } from '@/types/refuel';
import { Fuel, Calendar, LogOut, Settings, User } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import simbaLogo from '@/assets/simba-logo-hd.png';

interface DatabaseRefuelRecord {
  id: string;
  branch_id: string;
  reservation_number: string;
  rego: string;
  added_to_rcm: boolean;
  amount: number;
  refuelled_by: string;
  created_at: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, signOut, loading } = useAuthContext();
  const { logActivity } = useActivityLog();
  const [records, setRecords] = useState<RefuelRecord[]>([]);
  const [staff, setStaff] = useState<Staff[]>([
    { id: '1', name: 'Kartik' },
    { id: '2', name: 'Maaz' },
    { id: '3', name: 'Naeem' },
    { id: '4', name: 'Katrina' },
    { id: '5', name: 'Jenny' },
    { id: '6', name: 'Jamil' },
    { id: '7', name: 'Chenar' },
    { id: '8', name: 'Rusdan' },
  ]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const { toast } = useToast();

  // Redirect to auth if not logged in, not approved, or redirect admins to dashboard
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (profile?.status !== 'approved') {
        navigate('/auth');
      } else if (profile?.role === 'admin' && !searchParams.get('branch')) {
        // Redirect admin users to admin dashboard if no specific branch requested
        navigate('/admin');
      }
    }
  }, [user, profile, loading, navigate, searchParams]);

  // Load records when branch changes or handle URL branch parameter
  useEffect(() => {
    // Check for branch parameter in URL
    const branchParam = searchParams.get('branch');
    if (branchParam && !selectedBranchId && profile?.status === 'approved') {
      setSelectedBranchId(branchParam);
      return;
    }
    
    if (selectedBranchId && user && profile?.status === 'approved') {
      loadBranchRecords();
    } else if (profile?.branch_id && !selectedBranchId && profile?.status === 'approved' && !branchParam) {
      // Auto-select user's branch if they're staff and no URL param
      setSelectedBranchId(profile.branch_id);
    }
  }, [selectedBranchId, user, profile, searchParams]);

  const loadBranchRecords = async () => {
    if (!selectedBranchId) return;

    setLoadingData(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('refuel_records')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert database records to frontend format
      const convertedRecords = (data || []).map((record: DatabaseRefuelRecord) => ({
        id: record.id,
        reservationNumber: record.reservation_number,
        rego: record.rego,
        addedToRCM: record.added_to_rcm,
        amount: record.amount,
        refuelledBy: record.refuelled_by,
        createdAt: new Date(record.created_at),
      }));

      setRecords(convertedRecords);
      
      await logActivity('view', 'refuel_records', undefined, { 
        branch_id: selectedBranchId, 
        count: convertedRecords.length 
      }, selectedBranchId);
    } catch (error) {
      console.error('Error loading records:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load refuel records.",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const addRecord = async (recordData: Omit<RefuelRecord, 'id' | 'createdAt'>) => {
    if (!selectedBranchId || !user) return;

    try {
      const { data, error } = await supabase
        .from('refuel_records')
        .insert([{
          branch_id: selectedBranchId,
          reservation_number: recordData.reservationNumber,
          rego: recordData.rego,
          added_to_rcm: recordData.addedToRCM,
          amount: recordData.amount,
          refuelled_by: recordData.refuelledBy,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      const newRecord: RefuelRecord = {
        id: data.id,
        reservationNumber: data.reservation_number,
        rego: data.rego,
        addedToRCM: data.added_to_rcm,
        amount: data.amount,
        refuelledBy: data.refuelled_by,
        createdAt: new Date(data.created_at),
      };

      setRecords(prev => [newRecord, ...prev]);
      
      toast({
        title: "Record Added",
        description: `Refuel record for ${recordData.rego} has been added successfully.`,
      });

      await logActivity('create', 'refuel_record', data.id, recordData, selectedBranchId);
    } catch (error) {
      console.error('Error adding record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add refuel record.",
      });
    }
  };

  const removeRecord = async (id: string) => {
    if (!selectedBranchId) return;

    try {
      const { error } = await supabase
        .from('refuel_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRecords(prev => prev.filter(record => record.id !== id));
      
      toast({
        title: "Record Removed",
        description: "The refuel record has been removed successfully.",
      });

      await logActivity('delete', 'refuel_record', id, undefined, selectedBranchId);
    } catch (error) {
      console.error('Error removing record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove refuel record.",
      });
    }
  };

  const addStaff = (name: string) => {
    const newStaff: Staff = {
      id: crypto.randomUUID(),
      name,
    };
    setStaff(prev => [...prev, newStaff]);
    toast({
      title: "Staff Added",
      description: `${name} has been added to the staff list.`,
    });
  };

  const removeStaff = (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    setStaff(prev => prev.filter(s => s.id !== id));
    toast({
      title: "Staff Removed",
      description: `${staffMember?.name} has been removed from the staff list.`,
    });
  };

  const handleSignOut = async () => {
    await logActivity('logout', 'auth', undefined, undefined, selectedBranchId);
    await signOut();
  };

  // Don't render anything while loading or if not authenticated
  if (loading || !user || profile?.status !== 'approved') {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={simbaLogo} alt="Simba Car Hire" className="h-12" />
              <div>
                <h1 className="text-2xl font-bold text-primary">Refuel Management System</h1>
                <p className="text-sm text-muted-foreground">Daily refuel tracking and reporting</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <BranchSelector 
                  selectedBranchId={selectedBranchId}
                  onBranchChange={setSelectedBranchId}
                  className="w-48"
                />
                {profile?.role === 'admin' && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* User Info */}
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Welcome, {profile?.first_name} {profile?.last_name}</span>
            <span className="text-xs">•</span>
            <span className="capitalize">{profile?.role}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {!selectedBranchId ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Select Branch</CardTitle>
              <CardDescription>
                Please select a branch to view and manage refuel records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BranchSelector 
                selectedBranchId={selectedBranchId}
                onBranchChange={setSelectedBranchId}
                className="w-full"
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card p-6 rounded-lg shadow-md border border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Fuel className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {loadingData ? '...' : records.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Records Today</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-md border border-success/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <span className="text-success font-bold">$</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">
                      ${loadingData ? '...' : records.reduce((sum, record) => sum + record.amount, 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-md border border-accent/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <span className="text-accent font-bold">RCM</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-accent">
                      {loadingData ? '...' : records.filter(r => r.addedToRCM).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Added to RCM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Forms and Management */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <RefuelForm staff={staff} onAddRecord={addRecord} />
                <RefuelTable records={records} onRemoveRecord={removeRecord} />
              </div>
              
              <div className="space-y-6">
                <StaffManagement 
                  staff={staff} 
                  onAddStaff={addStaff} 
                  onRemoveStaff={removeStaff} 
                />
                <PDFGenerator records={records} staff={staff} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © 2024 Simba Car Hire. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Refuel Management System v2.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
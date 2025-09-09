import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { RefuelForm } from '@/components/RefuelForm';
import { StaffManagement } from '@/components/StaffManagement';
import { RefuelTable } from '@/components/RefuelTable';
import { PDFGenerator } from '@/components/PDFGenerator';
import { PasswordChangeDialog } from '@/components/PasswordChangeDialog';
import BranchSelector from '@/components/BranchSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefuelRecord } from '@/types/refuel';
import { DatabaseRefuelRecord } from '@/types/database';
import { Fuel, Calendar, LogOut, Settings, User, RotateCcw, AlertTriangle } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { useStaff } from '@/hooks/useStaff';
import { supabase } from '@/integrations/supabase/client';
import simbaLogo from '@/assets/simba-logo-hd.png';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, signOut, loading } = useAuthContext();
  const [records, setRecords] = useState<RefuelRecord[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string>('');
  const [loadingData, setLoadingData] = useState(false);
  const [showDateWarning, setShowDateWarning] = useState(false);
  const { staff, loading: staffLoading, addStaff, removeStaff } = useStaff(selectedBranchId || undefined);

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
      loadBranchInfo();
    } else if (profile?.branch_id && !selectedBranchId && profile?.status === 'approved' && !branchParam) {
      // Auto-select user's branch if they're staff and no URL param
      setSelectedBranchId(profile.branch_id);
    }
  }, [selectedBranchId, user, profile, searchParams]);

  // Check for date warnings when records change
  useEffect(() => {
    checkDateWarnings();
  }, [records]);

  const loadBranchInfo = async () => {
    if (!selectedBranchId) return;

    try {
      const { data, error } = await supabase
        .from('branches')
        .select('name')
        .eq('id', selectedBranchId)
        .single();

      if (error) throw error;
      setSelectedBranchName(data.name);
    } catch (error) {
      console.error('Error loading branch info:', error);
    }
  };

  const loadBranchRecords = async () => {
    if (!selectedBranchId) return;

    setLoadingData(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('refuel_records')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .eq('is_temporary', true)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .order('refuel_datetime', { ascending: false });

      if (error) throw error;

      // Convert database records to frontend format
      const convertedRecords = (data || []).map((record: DatabaseRefuelRecord) => ({
        id: record.id,
        reservationNumber: record.reservation_number,
        rego: record.rego,
        addedToRCM: record.added_to_rcm,
        amount: Number(record.amount),
        refuelledBy: record.refuelled_by,
        createdAt: new Date(record.created_at),
        refuelDateTime: new Date(record.refuel_datetime),
        isTemporary: record.is_temporary,
      }));

      setRecords(convertedRecords);
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

  const checkDateWarnings = () => {
    const hasOldRecords = records.some(record => !isToday(record.refuelDateTime));
    setShowDateWarning(hasOldRecords);
  };

  const addRecord = async (recordData: Omit<RefuelRecord, 'id' | 'createdAt'>) => {
    if (!selectedBranchId || !user) return;

    try {
      const { data, error } = await supabase
        .from('refuel_records')
        .insert({
          branch_id: selectedBranchId,
          reservation_number: recordData.reservationNumber,
          rego: recordData.rego,
          added_to_rcm: recordData.addedToRCM,
          amount: recordData.amount,
          refuelled_by: recordData.refuelledBy,
          created_by: user.id,
          is_temporary: true,
          refuel_datetime: recordData.refuelDateTime.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      const newRecord: RefuelRecord = {
        id: data.id,
        reservationNumber: data.reservation_number,
        rego: data.rego,
        addedToRCM: data.added_to_rcm,
        amount: Number(data.amount),
        refuelledBy: data.refuelled_by,
        createdAt: new Date(data.created_at),
        refuelDateTime: new Date(data.refuel_datetime),
        isTemporary: data.is_temporary,
      };

      setRecords(prev => [newRecord, ...prev]);
      
      toast({
        title: "Record Added",
        description: `Refuel record for ${recordData.rego} has been added successfully.`,
      });
    } catch (error) {
      console.error('Error adding record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add refuel record.",
      });
    }
  };

  const updateRecord = async (id: string, updatedData: Partial<RefuelRecord>) => {
    if (!selectedBranchId) return;

    try {
      const updateObject: any = {};
      
      if (updatedData.reservationNumber) updateObject.reservation_number = updatedData.reservationNumber;
      if (updatedData.rego) updateObject.rego = updatedData.rego;
      if (updatedData.addedToRCM !== undefined) updateObject.added_to_rcm = updatedData.addedToRCM;
      if (updatedData.amount !== undefined) updateObject.amount = updatedData.amount;
      if (updatedData.refuelledBy) updateObject.refuelled_by = updatedData.refuelledBy;
      if (updatedData.refuelDateTime) updateObject.refuel_datetime = updatedData.refuelDateTime.toISOString();

      const { error } = await supabase
        .from('refuel_records')
        .update(updateObject)
        .eq('id', id);

      if (error) throw error;

      setRecords(prev => prev.map(record => 
        record.id === id ? { ...record, ...updatedData } : record
      ));
      
      toast({
        title: "Record Updated",
        description: "The refuel record has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update refuel record.",
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
    } catch (error) {
      console.error('Error removing record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove refuel record.",
      });
    }
  };

  const resetTable = async () => {
    if (!selectedBranchId) return;

    try {
      const { error } = await supabase
        .from('refuel_records')
        .delete()
        .eq('branch_id', selectedBranchId)
        .eq('is_temporary', true);

      if (error) throw error;

      setRecords([]);
      setShowDateWarning(false);
      
      toast({
        title: "Table Reset",
        description: "All temporary refuel records have been cleared.",
      });
    } catch (error) {
      console.error('Error resetting table:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset refuel table.",
      });
    }
  };

  const handleSignOut = async () => {
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
                <PasswordChangeDialog />
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
            {/* Date Warning Alert */}
            {showDateWarning && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Warning: Some records are from a previous date. Consider resetting the table for today's data.
                </AlertDescription>
              </Alert>
            )}

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

            {/* Reset Button */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={resetTable}
                className="gap-2"
                disabled={records.length === 0}
              >
                <RotateCcw className="h-4 w-4" />
                Reset Table
              </Button>
            </div>

            {/* Forms and Management */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <RefuelForm staff={staff} onAddRecord={addRecord} />
                <RefuelTable 
                  records={records} 
                  onRemoveRecord={removeRecord}
                  onUpdateRecord={updateRecord}
                />
              </div>
              
              <div className="space-y-6">
                <StaffManagement 
                  staff={staff} 
                  onAddStaff={addStaff} 
                  onRemoveStaff={removeStaff}
                  loading={staffLoading}
                />
                <PDFGenerator 
                  records={records} 
                  staff={staff}
                  branchName={selectedBranchName}
                  branchId={selectedBranchId}
                />
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
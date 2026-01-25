import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import RefuelForm from '@/components/RefuelForm';
import { StaffManagement } from '@/components/StaffManagement';
import { RefuelTable } from '@/components/RefuelTable';
import { PDFGenerator } from '@/components/PDFGenerator';
import { PasswordChangeDialog } from '@/components/PasswordChangeDialog';
import BranchSelector from '@/components/BranchSelector';
import { HeaderMenu } from '@/components/HeaderMenu';
import EmailReportSender from '@/components/EmailReportSender';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefuelRecord, RefuelFormData, RefuelRecordUpdate } from '@/types/refuel';
import { DatabaseRefuelRecord } from '@/types/database';
import { Fuel, Calendar, LogOut, Settings, User, AlertTriangle, CalendarIcon } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { useStaff } from '@/hooks/useStaff';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import simbaLogo from '@/assets/simba-logo-hd.png';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, signOut, loading } = useAuthContext();
  const [records, setRecords] = useState<RefuelRecord[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string>('');
  const [loadingData, setLoadingData] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  // Load records when branch or date changes or handle URL branch parameter
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
  }, [selectedBranchId, user, profile, searchParams, selectedDate]);

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
      // Create start and end dates in local timezone, then convert to UTC for database query
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('refuel_records')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedRecords: RefuelRecord[] = (data || []).map(record => ({
        id: record.id,
        rego: record.rego,
        amount: record.amount,
        refuelledBy: record.refuelled_by,
        reservationNumber: record.reservation_number,
        addedToRCM: record.added_to_rcm ?? false,
        createdAt: new Date(record.created_at || new Date()),
        receiptPhotoUrl: record.receipt_photo_url ?? undefined,
      }));

      setRecords(transformedRecords);
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

  const addRecord = async (recordData: RefuelFormData & {
    addedToRCM: boolean;
    createdAt: Date;
    createdBy: string;
  }) => {
    if (!selectedBranchId || !user) return;

    try {
      const { error } = await supabase
        .from('refuel_records')
        .insert({
          branch_id: selectedBranchId,
          rego: recordData.rego.toUpperCase(),
          amount: parseFloat(recordData.amount),
          reservation_number: recordData.reservationNumber,
          refuelled_by: recordData.refuelledBy,
          created_by: recordData.createdBy,
          created_at: recordData.createdAt.toISOString(),
          added_to_rcm: recordData.addedToRCM,
          receipt_photo_url: recordData.receiptPhotoUrl,
        })
        .select()
        .single();

      if (error) throw error;

      // Reload records to reflect the new addition
      await loadBranchRecords();

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

  const updateRecord = async (id: string, updatedData: RefuelRecordUpdate) => {
    if (!selectedBranchId) return;

    try {
      const updateObject: any = {};

      if (updatedData.rego) updateObject.rego = updatedData.rego.toUpperCase();
      if (updatedData.amount) updateObject.amount = updatedData.amount;
      if (updatedData.reservationNumber) updateObject.reservation_number = updatedData.reservationNumber;
      if (updatedData.refuelledBy) updateObject.refuelled_by = updatedData.refuelledBy;
      if (updatedData.createdAt) {
        updateObject.created_at = updatedData.createdAt.toISOString();
      }
      if (updatedData.receiptPhotoUrl !== undefined) updateObject.receipt_photo_url = updatedData.receiptPhotoUrl;

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
              <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <BranchSelector
                  selectedBranchId={selectedBranchId}
                  onBranchChange={setSelectedBranchId}
                  className="w-48"
                />
                <HeaderMenu profile={profile} onSignOut={handleSignOut} />
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
            {/* Date Selector */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Refuel Records for {format(selectedDate, 'MMMM d, yyyy')}</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

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
                <RefuelForm
                  onSubmit={addRecord}
                  staffMembers={staff}
                />
                <RefuelTable
                  records={records}
                  onRemoveRecord={removeRecord}
                  onUpdateRecord={updateRecord}
                  selectedDate={selectedDate}
                  staff={staff}
                />
              </div>

              <div className="space-y-6">
                <StaffManagement
                  staff={staff}
                  onAddStaff={addStaff}
                  onRemoveStaff={removeStaff}
                  loading={staffLoading}
                />
                <div className="space-y-4">
                  <PDFGenerator
                    records={records}
                    staff={staff}
                    branchName={selectedBranchName}
                    branchId={selectedBranchId}
                    reportDate={selectedDate}
                  />
                  <EmailReportSender
                    records={records}
                    branchName={selectedBranchName}
                    date={selectedDate}
                  />
                </div>
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
import { useState, useEffect } from 'react';
import { RefuelForm } from '@/components/RefuelForm';
import { StaffManagement } from '@/components/StaffManagement';
import { RefuelTable } from '@/components/RefuelTable';
import { PDFGenerator } from '@/components/PDFGenerator';
import { RefuelRecord, Staff } from '@/types/refuel';
import { Fuel, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import simbaLogo from '@/assets/simba-logo-hd.png';

const Index = () => {
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
  const { toast } = useToast();

  // Load data from localStorage on mount
  useEffect(() => {
    const savedRecords = localStorage.getItem('refuelRecords');
    const savedStaff = localStorage.getItem('staffMembers');
    
    if (savedRecords) {
      try {
        const parsed = JSON.parse(savedRecords);
        const today = format(new Date(), 'yyyy-MM-dd');
        const todayRecords = parsed.filter((record: any) => 
          format(new Date(record.createdAt), 'yyyy-MM-dd') === today
        );
        setRecords(todayRecords.map((record: any) => ({
          ...record,
          createdAt: new Date(record.createdAt)
        })));
      } catch (error) {
        console.error('Error loading records:', error);
      }
    }
    
    if (savedStaff) {
      try {
        setStaff(JSON.parse(savedStaff));
      } catch (error) {
        console.error('Error loading staff:', error);
      }
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('refuelRecords', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('staffMembers', JSON.stringify(staff));
  }, [staff]);

  const addRecord = (recordData: Omit<RefuelRecord, 'id' | 'createdAt'>) => {
    const newRecord: RefuelRecord = {
      ...recordData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setRecords(prev => [newRecord, ...prev]);
    toast({
      title: "Record Added",
      description: `Refuel record for ${recordData.rego} has been added successfully.`,
    });
  };

  const removeRecord = (id: string) => {
    setRecords(prev => prev.filter(record => record.id !== id));
    toast({
      title: "Record Removed",
      description: "The refuel record has been removed successfully.",
    });
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
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card p-6 rounded-lg shadow-md border border-primary/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Fuel className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{records.length}</p>
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
                  ${records.reduce((sum, record) => sum + record.amount, 0).toFixed(2)}
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
                  {records.filter(r => r.addedToRCM).length}
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
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © 2024 Simba Car Hire. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Refuel Management System v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
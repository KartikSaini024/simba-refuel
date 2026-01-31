import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { validateRefuelForm } from '@/utils/validation';
import { RefuelFormData } from '@/types/refuel';
import PhotoUpload from './PhotoUpload';
import { Plus, CalendarIcon, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface RefuelFormProps {
  onSubmit: (data: RefuelFormData & {
    addedToRCM: boolean;
    createdAt: Date;
    createdBy: string;
  }) => Promise<void>;
  staffMembers: Array<{ id: string; name: string }>;
  isSubmitting?: boolean;
}

const RefuelForm: React.FC<RefuelFormProps> = ({
  onSubmit,
  staffMembers,
  isSubmitting = false
}) => {
  const { toast } = useToast();
  const { user } = useAuthContext();
  const [formData, setFormData] = useState<RefuelFormData>({
    rego: '',
    amount: '',
    refuelledBy: '',
    reservationNumber: '',
    receiptPhotoUrl: ''
  });
  const [addedToRCM, setAddedToRCM] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `receipt-${Date.now()}.${fileExt}`;
      const filePath = `receipt-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('refuel-receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('refuel-receipts')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: "Failed to upload receipt photo."
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = validateRefuelForm(formData);
    if (!validationResult.isValid) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validationResult.errors.join(', ')
      });
      return;
    }

    let photoUrl = formData.receiptPhotoUrl;

    // Upload photo if one is selected
    if (selectedPhoto) {
      const uploadedUrl = await uploadPhoto(selectedPhoto);
      if (uploadedUrl) {
        photoUrl = uploadedUrl;
      } else {
        return; // Upload failed
      }
    }

    await onSubmit({
      ...formData,
      receiptPhotoUrl: photoUrl || '',
      addedToRCM,
      createdAt: selectedDate,
      createdBy: user?.id || ''
    });

    // Reset form
    setFormData({
      rego: '',
      amount: '',
      refuelledBy: '',
      reservationNumber: '',
      receiptPhotoUrl: ''
    });
    setAddedToRCM(false);
    setSelectedDate(new Date());
    setSelectedPhoto(null);
  };

  const handlePhotoSelected = (file: File | null) => {
    setSelectedPhoto(file);
    if (file) {
      setFormData({ ...formData, receiptPhotoUrl: '' }); // Clear existing URL when new file selected
    }
  };

  // --- RCM Search Logic ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleRcmSearch = async () => {
    if (!formData.rego) {
      toast({ variant: "destructive", title: "Registration Required", description: "Please enter a Rego first." });
      return;
    }

    const cookies = localStorage.getItem('rcm_cookies');
    console.log("RefuelForm: Retrieving cookies...", cookies ? "Found" : "Not Found");

    if (!cookies) {
      toast({
        variant: "destructive",
        title: "Not Connected",
        description: "Please run 'Test RCM' from the menu first to authenticate."
      });
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      // Use today's date formatted as dd/MM/yyyy
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;

      const res = await fetch('/api/rcm-reservation-search', {
        method: 'POST',
        body: JSON.stringify({ rego: formData.rego, cookies, dateStr })
      });

      const data = await res.json();

      if (data.success && data.results) {
        // Sort by Reservation Number descending and take top 5
        const sortedResults = data.results.sort((a: any, b: any) => parseInt(b.resNo) - parseInt(a.resNo));
        setSearchResults(sortedResults.slice(0, 5));

        setShowResults(true);
        if (data.results.length === 0) {
          toast({ title: "No Results", description: "No reservations found for this rego today." });
        }
      } else {
        throw new Error(data.error || "Unknown error");
      }

    } catch (err: any) {
      console.error("Search failed", err);
      toast({
        variant: "destructive",
        title: "Search Failed",
        description: err.message || "Could not fetch results."
      });
    } finally {
      setIsSearching(false);
    }
  };

  const openReservation = (resNo: string) => {
    // Open in new popup window as per requirement
    window.open(`https://bookings.rentalcarmanager.com/reservations/update/booking/${resNo}`, '_blank', 'width=1200,height=800');
  };


  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `Reservation ${text} copied to clipboard.` });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy to clipboard." });
    }
  };

  const selectReservation = (resNo: string) => {
    setFormData(prev => ({ ...prev, reservationNumber: resNo }));
    setShowResults(false);
    toast({ title: "Reservation Selected", description: `Reservation #${resNo} added to form.` });
  };

  return (
    <Card className="bg-gradient-to-br from-background to-muted/20 shadow-elegant border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Add Refuel Record
        </CardTitle>
        <CardDescription>
          Enter the details of the fuel transaction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rego">Vehicle Registration</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="rego"
                    value={formData.rego}
                    onChange={(e) => setFormData({ ...formData, rego: e.target.value.toUpperCase() })}
                    placeholder="Enter registration"
                    required
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={handleRcmSearch} disabled={isSearching} title="Search RCM">
                  {isSearching ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Dialog open={showResults} onOpenChange={setShowResults}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Reservation Search Results</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  {searchResults.length > 0 ? (
                    <div className="border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Res #</th>
                            <th className="p-2 text-left">Customer</th>
                            <th className="p-2 text-left">Vehicle</th>
                            <th className="p-2 text-center">View</th>
                            <th className="p-2 text-center">Use</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Find the index of the first record containing "Returned"
                            const firstReturnedIndex = searchResults.findIndex((res: any) =>
                              JSON.stringify(res).toLowerCase().includes('returned')
                            );

                            return searchResults.map((res: any, index: number) => {
                              const isReturned = index === firstReturnedIndex;

                              return (
                                <tr
                                  key={res.resNo}
                                  className={cn(
                                    "border-t transition-colors",
                                    isReturned ? "animate-pulse-green" : "hover:bg-muted/50"
                                  )}
                                >
                                  <td className="p-2 font-medium">
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(res.resNo)}
                                      className="hover:underline flex items-center gap-1 text-primary focus:outline-none"
                                      title="Click to copy"
                                    >
                                      {res.resNo}
                                    </button>
                                  </td>
                                  <td className="p-2">{res.customer}</td>
                                  <td className="p-2">{res.vehicle.split(' ')[0]}</td>
                                  <td className="p-2 text-center">
                                    <Button size="sm" onClick={() => openReservation(res.resNo)}>
                                      Open
                                    </Button>
                                  </td>
                                  <td className="p-2 text-center">
                                    <Button size="sm" variant="outline" onClick={() => selectReservation(res.resNo)}>
                                      Add
                                    </Button>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No reservations found.</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refuelled-by">Refuelled By</Label>
              <select
                id="refuelled-by"
                value={formData.refuelledBy}
                onChange={(e) => setFormData({ ...formData, refuelledBy: e.target.value })}
                className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              >
                <option value="">Select staff member</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.name}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservation">Reservation Number</Label>
              <Input
                id="reservation"
                value={formData.reservationNumber}
                onChange={(e) => setFormData({ ...formData, reservationNumber: e.target.value })}
                placeholder="Enter reservation number"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP 'at' HH:mm") : <span>Pick date & time</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = new Date(date);
                        newDate.setHours(selectedDate.getHours());
                        newDate.setMinutes(selectedDate.getMinutes());
                        setSelectedDate(newDate);
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  <div className="p-3 border-t">
                    <Input
                      type="time"
                      value={format(selectedDate, "HH:mm")}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(selectedDate);
                        newDate.setHours(parseInt(hours));
                        newDate.setMinutes(parseInt(minutes));
                        setSelectedDate(newDate);
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>RCM Status</Label>
              <div className="flex items-center space-x-2 mt-2">
                <Switch
                  id="rcm-status"
                  checked={addedToRCM}
                  onCheckedChange={setAddedToRCM}
                />
                <Label htmlFor="rcm-status" className="text-sm">
                  {addedToRCM ? 'Added to RCM' : 'Not added to RCM'}
                </Label>
              </div>
            </div>
          </div>

          <PhotoUpload
            onPhotoSelected={handlePhotoSelected}
            selectedFile={selectedPhoto}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? 'Adding Record...' : 'Add Record'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RefuelForm;
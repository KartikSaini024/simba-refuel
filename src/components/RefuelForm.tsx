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
import { Plus, CalendarIcon } from 'lucide-react';
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
              <Input
                id="rego"
                value={formData.rego}
                onChange={(e) => setFormData({ ...formData, rego: e.target.value.toUpperCase() })}
                placeholder="Enter registration"
                required
              />
            </div>

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
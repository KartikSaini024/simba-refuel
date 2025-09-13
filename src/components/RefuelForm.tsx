import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { validateRefuelForm } from '@/utils/validation';
import { RefuelFormData } from '@/types/refuel';
import PhotoUpload from './PhotoUpload';
import { Plus } from 'lucide-react';

interface RefuelFormProps {
  onSubmit: (data: RefuelFormData) => Promise<void>;
  staffMembers: Array<{ id: string; name: string }>;
  isSubmitting?: boolean;
}

const RefuelForm: React.FC<RefuelFormProps> = ({ 
  onSubmit, 
  staffMembers, 
  isSubmitting = false 
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<RefuelFormData>({
    rego: '',
    amount: '',
    refuelledBy: '',
    reservationNumber: '',
    receiptPhotoUrl: ''
  });
  const [isUploading, setIsUploading] = useState(false);

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

    await onSubmit(formData);
    
    // Reset form
    setFormData({
      rego: '',
      amount: '',
      refuelledBy: '',
      reservationNumber: '',
      receiptPhotoUrl: ''
    });
  };

  const handlePhotoSelected = (file: File | null) => {
    // Handle photo selection but we're not using photo upload in the simplified form
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

          <PhotoUpload 
            onPhotoSelected={handlePhotoSelected}
            selectedFile={null}
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
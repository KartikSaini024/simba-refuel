import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { RefuelRecord, Staff } from '@/types/refuel';
import PhotoUpload from '@/components/PhotoUpload';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface RefuelFormProps {
  staff: Staff[];
  onAddRecord: (record: Omit<RefuelRecord, 'id' | 'createdAt'>) => void;
}

export const RefuelForm = ({ staff, onAddRecord }: RefuelFormProps) => {
  const { profile } = useAuthContext();
  const [formData, setFormData] = useState({
    reservationNumber: '',
    rego: '',
    addedToRCM: false,
    amount: '',
    refuelledBy: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const compressImage = (file: File, quality: number = 0.7): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        const maxWidth = 1200;
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;

        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }
        }, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reservationNumber || !formData.rego || !formData.amount || !formData.refuelledBy) {
      return;
    }

    let receiptPhotoUrl: string | undefined;

    if (selectedFile) {
      try {
        const compressedFile = await compressImage(selectedFile);
        const fileExt = 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('refuel-receipts')
          .upload(fileName, compressedFile);

        if (error) throw error;
        receiptPhotoUrl = data.path;
      } catch (error) {
        console.error('Error uploading photo:', error);
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: "Failed to upload photo. Record will be saved without image.",
        });
      }
    }

    onAddRecord({
      reservationNumber: formData.reservationNumber,
      rego: formData.rego.toUpperCase(),
      addedToRCM: formData.addedToRCM,
      amount: parseFloat(formData.amount),
      refuelledBy: formData.refuelledBy,
      refuelDateTime: new Date(),
      receiptPhotoUrl,
    });

    setFormData({
      reservationNumber: '',
      rego: '',
      addedToRCM: false,
      amount: '',
      refuelledBy: '',
    });
    setSelectedFile(null);
  };

  return (
    <Card className="bg-gradient-subtle shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Plus className="h-5 w-5" />
          Add Refuel Record
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reservationNumber">Reservation Number</Label>
              <Input
                id="reservationNumber"
                value={formData.reservationNumber}
                onChange={(e) => setFormData({ ...formData, reservationNumber: e.target.value })}
                placeholder="Enter reservation number"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rego">Registration</Label>
              <Input
                id="rego"
                value={formData.rego}
                onChange={(e) => setFormData({ ...formData, rego: e.target.value.toUpperCase() })}
                placeholder="Enter vehicle registration"
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
              <Label htmlFor="refuelledBy">Refuelled By</Label>
              <Select
                value={formData.refuelledBy}
                onValueChange={(value) => setFormData({ ...formData, refuelledBy: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.name}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <PhotoUpload
            onPhotoSelected={setSelectedFile}
            selectedFile={selectedFile}
          />

          <div className="space-y-2">
            <Label htmlFor="createdBy">Created By</Label>
            <Input
              id="createdBy"
              value={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              This field is automatically filled with your account information
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="rcm"
              checked={formData.addedToRCM}
              onCheckedChange={(checked) => setFormData({ ...formData, addedToRCM: checked })}
            />
            <Label htmlFor="rcm">Added to RCM</Label>
          </div>

          <Button type="submit" className="w-full bg-gradient-primary hover:bg-primary-hover">
            Add Record
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
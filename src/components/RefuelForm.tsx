import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { RefuelRecord, Staff } from '@/types/refuel';

interface RefuelFormProps {
  staff: Staff[];
  onAddRecord: (record: Omit<RefuelRecord, 'id' | 'createdAt'>) => void;
}

export const RefuelForm = ({ staff, onAddRecord }: RefuelFormProps) => {
  const [formData, setFormData] = useState({
    reservationNumber: '',
    rego: '',
    addedToRCM: false,
    amount: '',
    refuelledBy: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reservationNumber || !formData.rego || !formData.amount || !formData.refuelledBy) {
      return;
    }

    onAddRecord({
      reservationNumber: formData.reservationNumber,
      rego: formData.rego.toUpperCase(),
      addedToRCM: formData.addedToRCM,
      amount: parseFloat(formData.amount),
      refuelledBy: formData.refuelledBy,
      refuelDateTime: new Date(),
    });

    setFormData({
      reservationNumber: '',
      rego: '',
      addedToRCM: false,
      amount: '',
      refuelledBy: '',
    });
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
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Trash2 } from 'lucide-react';
import { Staff } from '@/types/refuel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface StaffManagementProps {
  staff: Staff[];
  onAddStaff: (name: string) => void;
  onRemoveStaff: (id: string) => void;
}

export const StaffManagement = ({ staff, onAddStaff, onRemoveStaff }: StaffManagementProps) => {
  const [newStaffName, setNewStaffName] = useState('');

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    
    onAddStaff(newStaffName.trim());
    setNewStaffName('');
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          Staff Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAddStaff} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="staffName" className="sr-only">Staff Name</Label>
            <Input
              id="staffName"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="Enter staff member name"
            />
          </div>
          <Button type="submit" size="icon" disabled={!newStaffName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Current Staff ({staff.length})</Label>
          <div className="flex flex-wrap gap-2">
            {staff.map((member) => (
              <Badge key={member.id} variant="secondary" className="flex items-center gap-2 py-1 px-2">
                {member.name}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove "{member.name}" from the staff list? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRemoveStaff(member.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
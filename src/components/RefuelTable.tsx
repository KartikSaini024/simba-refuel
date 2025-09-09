import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, FileText, Edit2, Check, X } from 'lucide-react';
import { RefuelRecord } from '@/types/refuel';
import { format } from 'date-fns';
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

interface RefuelTableProps {
  records: RefuelRecord[];
  onRemoveRecord: (id: string) => void;
  onUpdateRecord?: (id: string, updatedData: Partial<RefuelRecord>) => void;
}

export const RefuelTable = ({ records, onRemoveRecord, onUpdateRecord }: RefuelTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<RefuelRecord>>({});
  const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);

  const startEditing = (record: RefuelRecord) => {
    setEditingId(record.id);
    setEditData({
      reservationNumber: record.reservationNumber,
      rego: record.rego,
      amount: record.amount,
      addedToRCM: record.addedToRCM,
    });
  };

  const saveEdit = () => {
    if (editingId && onUpdateRecord) {
      onUpdateRecord(editingId, editData);
      setEditingId(null);
      setEditData({});
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  if (records.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            Today's Refuel Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No refuel records for today. Add some records to get started.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <FileText className="h-5 w-5" />
          Today's Refuel Records ({records.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Reservation #</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>RCM Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Refuelled By</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    {editingId === record.id ? (
                      <Input
                        value={editData.reservationNumber || ''}
                        onChange={(e) => setEditData({ ...editData, reservationNumber: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      record.reservationNumber
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === record.id ? (
                      <Input
                        value={editData.rego || ''}
                        onChange={(e) => setEditData({ ...editData, rego: e.target.value.toUpperCase() })}
                        className="w-full"
                      />
                    ) : (
                      <Badge variant="outline" className="font-mono">
                        {record.rego}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === record.id ? (
                      <Switch
                        checked={editData.addedToRCM || false}
                        onCheckedChange={(checked) => setEditData({ ...editData, addedToRCM: checked })}
                      />
                    ) : (
                      <Badge variant={record.addedToRCM ? "default" : "secondary"}>
                        {record.addedToRCM ? "Yes" : "No"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {editingId === record.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.amount || ''}
                        onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) || 0 })}
                        className="w-24 ml-auto"
                      />
                    ) : (
                      `$${record.amount.toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell>{record.refuelledBy}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="space-y-1">
                      <div>{format(record.refuelDateTime, 'MMM d, yyyy')}</div>
                      <div className="text-xs">{format(record.refuelDateTime, 'HH:mm')}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {editingId === record.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-success hover:text-success-foreground"
                            onClick={saveEdit}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-muted"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {onUpdateRecord && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary hover:text-primary-foreground"
                              onClick={() => startEditing(record)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Record</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove this refuel record? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onRemoveRecord(record.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">${totalAmount.toFixed(2)}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
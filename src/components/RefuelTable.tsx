import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, FileText, RotateCcw } from 'lucide-react';
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
  onClearAll: () => void;
}

export const RefuelTable = ({ records, onRemoveRecord, onClearAll }: RefuelTableProps) => {
  const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-primary">
          <FileText className="h-5 w-5" />
          Today's Refuel Records ({records.length})
        </CardTitle>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset Table
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset All Records</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all refuel records from the table. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onClearAll}
                className="bg-destructive hover:bg-destructive/90"
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
                <TableHead>Time</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{record.reservationNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {record.rego}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={record.addedToRCM ? "default" : "secondary"}>
                      {record.addedToRCM ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${record.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{record.refuelledBy}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(record.createdAt, 'HH:mm')}
                  </TableCell>
                  <TableCell>
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
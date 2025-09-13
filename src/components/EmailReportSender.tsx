import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Mail, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { RefuelRecord } from '@/types/refuel';
import { format } from 'date-fns';

interface EmailReportSenderProps {
  records: RefuelRecord[];
  branchName: string;
  date?: Date;
}

const EmailReportSender: React.FC<EmailReportSenderProps> = ({
  records,
  branchName,
  date = new Date(),
}) => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(`Refuel Report - ${branchName} - ${format(date, 'dd/MM/yyyy')}`);
  const [message, setMessage] = useState(
    `Dear Team,\n\nPlease find the refuel list attached for ${format(date, 'EEEE, MMMM d, yyyy')}.\n\nBest regards,\n${branchName} Team`
  );
  const [open, setOpen] = useState(false);

  const handleSendEmail = () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter a recipient email address.",
      });
      return;
    }

    // Create email body with records table
    const tableHeader = 'Reservation\t\tRegistration\tRCM Status\t\tAmount\t\tRefuelled By\t\tTime';
    const tableSeparator = '─'.repeat(80);
    
    const recordsTable = records.map((record) => 
      `${record.reservationNumber.padEnd(12)}\t${record.rego.padEnd(12)}\t${(record.addedToRCM ? 'Yes' : 'No').padEnd(12)}\t$${record.amount.toFixed(2).padStart(8)}\t${record.refuelledBy.padEnd(15)}\t${format(record.createdAt, 'HH:mm')}`
    ).join('\n');

    const fullMessage = `${message}\n\n--- REFUEL RECORDS FOR ${format(date, 'dd/MM/yyyy').toUpperCase()} ---\n\n${tableHeader}\n${tableSeparator}\n${recordsTable}\n${tableSeparator}\n\nSUMMARY:\nTotal Records: ${records.length}\nTotal Amount: $${records.reduce((sum, record) => sum + record.amount, 0).toFixed(2)}\nAdded to RCM: ${records.filter(r => r.addedToRCM).length}`;

    // Create mailto URL
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMessage)}`;
    
    // Open email client
    try {
      window.open(mailtoUrl, '_blank');
    } catch (error) {
      // Fallback for some browsers
      window.location.href = mailtoUrl;
    }
    
    toast({
      title: "Email Client Opened",
      description: "Your default email client has been opened with the pre-filled message.",
    });

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Mail className="h-4 w-4 mr-2" />
          Send Email Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Email Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter recipient email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Records to be included</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>Total Records: {records.length}</p>
                <p>Total Amount: ${records.reduce((sum, record) => sum + record.amount, 0).toFixed(2)}</p>
                <p>Records added to RCM: {records.filter(r => r.addedToRCM).length}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSendEmail} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Open Email Client
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportSender;
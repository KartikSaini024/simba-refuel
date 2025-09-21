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
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`Refuel Report - ${branchName} - ${format(date, 'dd/MM/yyyy')}`);
  const [message, setMessage] = useState(
    ``
  );
  const [open, setOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const handleSendEmail = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter a recipient email address.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/sendReportEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          cc,
          subject,
          message,
          records,
          branchName,
          date: format(date, 'yyyy-MM-dd'),
        }),
      });
      if (res.ok) {
        toast({
          title: "Email Sent!",
          description: "The report was sent successfully.",
        });
        setOpen(false);
      } else {
        const data = await res.json();
        toast({
          variant: "destructive",
          title: "Failed to send email",
          description: data.error || 'An error occurred sending the email.',
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Could not send email. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
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
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">CC (optional)</Label>
            <Input
              id="cc"
              type="email"
              placeholder="Add CC email(s), comma separated"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              autoComplete="email"
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
            <Label htmlFor="message">Notes (Optional)</Label>
            <Textarea
              id="message"
              rows={6}
              placeholder='Add any additional notes...'
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
            <Button onClick={handleSendEmail} className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center w-full">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></span>
                  Sending...
                </span>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Send Email</>
              )}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportSender;
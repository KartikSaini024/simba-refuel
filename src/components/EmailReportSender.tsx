import React, { useState, useRef } from 'react';
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
  const [subject, setSubject] = useState(`Refuel Report ${branchName} - ${format(date, 'dd/MM/yyyy')}`);
  const [message, setMessage] = useState(
    ``
  );
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const formData = new FormData();
      formData.append('to', email);
      formData.append('cc', cc);
      formData.append('subject', subject);
      formData.append('message', message);
      formData.append('branchName', branchName);
      formData.append('date', new Date().toISOString());
      formData.append('records', JSON.stringify(records));
      attachments.forEach((file, idx) => {
        formData.append('attachments', file, file.name);
      });

      // const res = await fetch('/api/sendReportEmail', {  // for deployment with  API route
      const res = await fetch('http://localhost:5000/api/sendReportEmail', {   //for local testing with separate server
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast({
          title: "Email Sent!",
          description: "The report was sent successfully.",
        });
        setOpen(false);
        setAttachments([]);
      } else {
        const data = await res.json();
        toast({
          variant: "destructive",
          title: "Failed to send email",
          description: data?.error || "An error occurred sending the email.",
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
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
          <div className="space-y-2">
            <Label htmlFor="attachments">Attachments</Label>
            <input
              id="attachments"
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              disabled={isLoading}
            />
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {attachments.map((file, idx) => (
                  <li key={file.name + idx} className="flex items-center gap-2">
                    <span>{file.name}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeAttachment(idx)} disabled={isLoading}>
                      &times;
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
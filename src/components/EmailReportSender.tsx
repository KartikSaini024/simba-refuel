import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Send, Clock, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { RefuelRecord } from '@/types/refuel';
import { format } from 'date-fns';
import { generateRefuelPDF } from '@/utils/generateRefuelPDF';
import { supabase } from '@/integrations/supabase/client';

interface EmailReportSenderProps {
  records: RefuelRecord[];
  branchName: string;
  branchId: string;
  date?: Date;
}

const EmailReportSender: React.FC<EmailReportSenderProps> = ({
  records,
  branchName,
  branchId,
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

  // Auto-send settings
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("20:00");
  const [autoRecipient, setAutoRecipient] = useState("");
  const [autoCC, setAutoCC] = useState("");

  // Load settings from Supabase
  useEffect(() => {
    const fetchSettings = async () => {
      if (!branchId) return;

      try {
        const { data, error } = await supabase
          .from('branch_email_settings' as any)
          .select('*')
          .eq('branch_id', branchId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error fetching settings:', error);
          return;
        }

        if (data) {
          const settings = data as any;
          setAutoSendEnabled(settings.enabled ?? false);
          // Only slice if time exists and is in HH:MM:SS format
          setScheduleTime(settings.schedule_time ? settings.schedule_time.slice(0, 5) : "20:00");
          setAutoRecipient(settings.recipient ?? "");
          setAutoCC(settings.cc ?? "");
        } else {
          // Defaults
          setAutoSendEnabled(false);
          setScheduleTime("20:00");
          setAutoRecipient("");
          setAutoCC("");
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };

    fetchSettings();
  }, [branchId]);
  // ... (skip down to UI render for Inputs)
  // We need to use multiple replacement blocks or one large one. 
  // The tool supports multiple chunks in `multi_replace_file_content` but this is `replace_file_content`.
  // I will use `replace_file_content` for the state/logic first, then another call for UI if needed, or try to span it if close enough. 
  // They are far apart (lines 46-80 vs 460+). I'll use `multi_replace_file_content`.

  // Save handler using Supabase
  const handleSaveSettings = async () => {
    if (!branchId) return;

    try {
      const { error } = await supabase
        .from('branch_email_settings' as any)
        .upsert({
          branch_id: branchId,
          enabled: autoSendEnabled,
          schedule_time: scheduleTime,
          recipient: autoRecipient,
          cc: autoCC,
          updated_at: new Date().toISOString()
        }, { onConflict: 'branch_id' });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: `Auto-send configuration updated for ${branchName}.`,
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save settings.",
      });
    }
  };

  const handleResetStatus = async () => {
    if (!branchId) return;

    try {
      const { error } = await supabase
        .from('branch_email_settings' as any)
        .update({ last_sent_date: null })
        .eq('branch_id', branchId);

      if (error) throw error;

      toast({
        title: "Status Reset",
        description: "Daily send limit reset. Auto-send can now trigger again today.",
      });
    } catch (error: any) {
      console.error('Error resetting status:', error);
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: "Could not reset daily status.",
      });
    }
  };

  // Scheduler Logic
  useEffect(() => {
    const checkTimeAndSend = async () => {
      // Re-read enabled status directly from DB to be checking strictly ? 
      // Actually state is fine, but checking branchId is key
      if (!autoSendEnabled || !branchId) return;

      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      const todayDateStr = format(now, 'yyyy-MM-dd');

      // Basic time check first to avoid DB hits every minute if not needed
      if (currentTime !== scheduleTime) return;

      try {
        // Atomic Check-and-Set using RPC
        // This handles NULLs correctly (unlike raw .neq query)
        const { data: updated, error } = await supabase.rpc('claim_email_lock', {
          p_branch_id: branchId,
          p_today: todayDateStr
        });

        if (error) {
          console.error("Error attempting to claim auto-send lock:", error);
          return;
        }

        // If updated is false, it means we didn't acquire the lock (already sent today)
        if (!updated) {
          // Only log this occasionally or debug level to avoid spamming console
          // console.log(`Skipping auto-send for ${branchName}: Already sent today.`);
          return;
        }

        // We acquired the lock! Proceed to send.
        console.log(`Lock acquired. Auto-sending email for ${branchName}...`);

        try {
          // Fetch Today's Records explicitly
          // This ensures we send today's data even if the user is viewing a past date
          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);

          const { data: todaysRecordsData, error: recordsError } = await supabase
            .from('refuel_records')
            .select('*, refueler:staff!refuel_records_refueled_by_fkey(name)')
            .eq('branch_id', branchId)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())
            .order('created_at', { ascending: false });

          if (recordsError) {
            console.error("Error fetching today's records for auto-send:", recordsError);
            // We theoretically should release the lock here or retry, but strict error logging for now.
            return;
          }

          // Map to RefuelRecord type
          const todaysRecords: RefuelRecord[] = (todaysRecordsData || []).map((r: any) => ({
            id: r.id,
            rego: r.rego,
            amount: r.amount,
            refuelledBy: r.refueler?.name || r.refuelled_by || r.refueled_by || '',
            reservationNumber: r.reservation_number,
            addedToRCM: r.added_to_rcm ?? false,
            createdAt: new Date(r.created_at),
            receiptPhotoUrl: r.receipt_photo_url ?? undefined,
          }));

          console.log(`Fetched ${todaysRecords.length} records for auto-send.`);

          // Generate PDF
          const { pdfData, fileName } = await generateRefuelPDF({
            records: todaysRecords,
            branchName,
            checkedBy: "Automatic",
            saveOnly: false // Get data URI
          });

          // Convert Data URI to Blob/File
          const res = await fetch(pdfData);
          const blob = await res.blob();
          const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

          // Prepare Form Data
          const formData = new FormData();
          formData.append('to', autoRecipient);
          formData.append('cc', autoCC);
          formData.append('subject', `Refuel Report ${branchName} - ${format(now, 'dd/MM/yyyy')} (Auto)`);
          formData.append('message', "This is an automatically generated report.");
          formData.append('branchName', branchName);
          formData.append('date', now.toISOString());
          formData.append('records', JSON.stringify(todaysRecords));
          formData.append('attachments', pdfFile);

          // Send Email
          const response = await fetch('/api/send-email', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            toast({
              title: "Auto-Email Sent",
              description: `Report for ${branchName} automatically sent.`,
            });
          } else {
            console.error("Failed to auto-send email");
            toast({
              variant: "destructive",
              title: "Auto-Send Failed",
              description: "Email failed to send, but processed in system.",
            });
          }
        } catch (innerError) {
          console.error("Error during email generation/sending:", innerError);
        }

      } catch (error) {
        console.error("Error in auto-send wrapper:", error);
      }
    };

    const interval = setInterval(checkTimeAndSend, 60000); // Check every minute
    checkTimeAndSend();

    return () => clearInterval(interval);
  }, [autoSendEnabled, scheduleTime, autoRecipient, autoCC, records, branchName, branchId]);


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
      formData.append('date', date.toISOString());
      formData.append('records', JSON.stringify(records));

      // Append attachments if any
      attachments.forEach((file) => {
        formData.append('attachments', file, file.name);
      });

      // Point to our unified API endpoint (handled by Vite Plugin locally or Vercel Function in prod)
      const res = await fetch('/api/send-email', {
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
        let errorMessage = "Failed to send email";
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            errorMessage = data?.error || errorMessage;
          } catch {
            // failed to parse JSON, use text or status
            errorMessage = `Server Error (${res.status}): ${text.substring(0, 50)}...`;
          }
        } catch (e) {
          // failed to read text
          errorMessage = `Connection Error (${res.status})`;
        }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      console.error('Email send error:', err);
      toast({
        variant: "destructive",
        title: "Failed to send email",
        description: err.message || "An error occurred sending the email.",
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
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex-1">
            <Mail className="h-4 w-4 mr-2" />
            Send Email
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
                autoComplete="email"
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={autoSendEnabled ? "default" : "outline"}
            size="icon"
            title={autoSendEnabled ? "Auto-Send Enabled" : "Configure Auto-Send"}
            className={autoSendEnabled ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}
          >
            <Clock className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <h4 className="font-medium leading-none flex items-center gap-2">
              <Settings className="h-4 w-4" /> Auto-Send Settings
            </h4>
            <p className="text-sm text-muted-foreground">
              Automatically send report at a specific time.
            </p>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-send-toggle">Enable Auto-Send</Label>
              <Switch
                id="auto-send-toggle"
                checked={autoSendEnabled}
                onCheckedChange={setAutoSendEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-recipient">Recipient</Label>
              <Input
                id="auto-recipient"
                type="email"
                placeholder="manager@email.com"
                value={autoRecipient}
                onChange={(e) => setAutoRecipient(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-cc">CC</Label>
              <Input
                id="auto-cc"
                type="email"
                placeholder="branch@email.com"
                value={autoCC}
                onChange={(e) => setAutoCC(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveSettings} className="w-full">
              Save Settings
            </Button>

            <div className="pt-2 border-t">
              <Button
                onClick={handleResetStatus}
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-destructive"
              >
                Reset Daily Status (Allow Resend)
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default EmailReportSender;
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.9";
import { jsPDF } from "npm:jspdf@2.5.1";
import "npm:jspdf-autotable@3.8.1"; // Import for side effects

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role for cron jobs
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Get all enabled email settings
        const { data: settings, error: settingsError } = await supabase
            .from('branch_email_settings')
            .select(`
        *,
        branches (name)
      `)
            .eq('enabled', true);

        if (settingsError) throw settingsError;

        const results = [];

        // 2. Iterate through each settings config
        for (const config of settings) {
            const branchId = config.branch_id;
            const branchName = config.branches?.name || 'Unknown Branch';

            // 3. Time Check
            // Get Sydney Time
            const now = new Date();
            const sydneyTimeStr = now.toLocaleString("en-US", { timeZone: "Australia/Sydney", hour12: false });
            const sydneyDate = new Date(sydneyTimeStr);
            const currentHour = sydneyDate.getHours();
            const currentMinute = sydneyDate.getMinutes();
            const todayDateStr = sydneyDate.toISOString().split('T')[0];

            // Parse schedule_time (e.g. "20:00:00" or "20:00")
            let scheduledHour = 20;
            let scheduledMinute = 0;
            if (config.schedule_time) {
                const parts = config.schedule_time.split(':');
                if (parts.length >= 2) {
                    scheduledHour = parseInt(parts[0], 10);
                    scheduledMinute = parseInt(parts[1], 10);
                }
            }

            // If current time is BEFORE schedule time, skip
            if (currentHour < scheduledHour || (currentHour === scheduledHour && currentMinute < scheduledMinute)) {
                // console.log(`Skipping ${branchName}: Current time ${currentHour}:${currentMinute} is before schedule ${scheduledHour}:${scheduledMinute}`);
                // Don't mark as failed, just skip
                continue;
            }

            // Try to claim lock
            const { data: updated, error: lockError } = await supabase.rpc('claim_email_lock', {
                p_branch_id: branchId,
                p_today: todayDateStr
            });

            if (lockError) {
                console.error(`Error claiming lock for ${branchName}:`, lockError);
                continue;
            }

            if (!updated) {
                // Already sent today
                results.push({ branch: branchName, status: 'Already sent today' });
                continue;
            }

            // Lock acquired! Proceed to send.
            console.log(`Sending email for ${branchName}...`);

            // Fetch records for "Today" in Sydney time
            // We need to query range in UTC that corresponds to Sydney's "Today"
            // This is complex, but let's approximate by grabbing last 24h or using the created_at > start_of_day_sydney

            // Actually simplest is: 
            // Get start of today in Sydney, convert to UTC
            const nowSydney = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
            const startOfDay = new Date(nowSydney);
            startOfDay.setHours(0, 0, 0, 0);

            // Note: New Date(sydneyString) creates a date object which if converted to ISO might be wrong relative to UTC if not careful.
            // It's safer to just fetch records created > today 00:00 local time
            // But since database stores UTC...

            // Let's just fetch records where created_at matches today's date in Sydney
            // Postgres has `timezone('Australia/Sydney', created_at)::date = current_date` but supabase-js is limited.
            // We'll fetch last 30 hours and filter in code to be safe.

            const thirtyHoursAgo = new Date();
            thirtyHoursAgo.setHours(thirtyHoursAgo.getHours() - 30);

            const { data: recordsData, error: recordsError } = await supabase
                .from('refuel_records')
                .select('*, staff(name)')
                .eq('branch_id', branchId)
                .gte('created_at', thirtyHoursAgo.toISOString()) // Fetch a wide net
                .order('created_at', { ascending: false });

            if (recordsError) {
                console.error(`Error fetching records for ${branchName}:`, recordsError);
                continue;
            }

            // Filter for Sydney Today
            const todaysRecords = recordsData.filter(r => {
                const rDate = new Date(r.created_at);
                // Check if this record's date (in Sydney) matches todayDateStr
                const rDateSydney = rDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // YYYY-MM-DD
                return rDateSydney === todayDateStr;
            });

            if (todaysRecords.length === 0) {
                console.log(`No records for ${branchName} today. Sending empty report? User said 'automatic email is only being sent if website is open'. Assumed yes.`);
                // Continue to send even if empty? Usually yes for "Report".
            }

            // Generate PDF
            // Note: jsPDF in Deno might lack 'window'. We use a specific import or polyfill if needed.
            // For now, let's try standard usage. If it fails, fallback to HTML only.
            let pdfBuffer: ArrayBuffer | null = null;
            try {
                const doc = new jsPDF();

                doc.setFontSize(18);
                doc.text("SIMBA CAR HIRE - REFUEL REPORT", 105, 20, { align: "center" });
                doc.setFontSize(12);
                doc.text(`Branch: ${branchName}`, 105, 30, { align: "center" });
                doc.text(`Date: ${todayDateStr}`, 105, 40, { align: "center" });

                const tableData = todaysRecords.map((r, i) => [
                    (i + 1).toString(),
                    r.reservation_number || '',
                    r.rego || '',
                    r.added_to_rcm ? 'Yes' : 'No',
                    `$${Number(r.amount).toFixed(2)}`,
                    r.staff?.name || r.refueled_by || '',
                    new Date(r.created_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false })
                ]);

                (doc as any).autoTable({
                    head: [['#', 'Res #', 'Rego', 'RCM', 'Amount', 'Staff', 'Time']],
                    body: tableData,
                    startY: 50,
                });

                const pdfArray = doc.output('arraybuffer');
                pdfBuffer = pdfArray;
            } catch (pdfErr) {
                console.error("PDF Generation failed:", pdfErr);
            }

            // Send Email
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: Deno.env.get('GMAIL_USER'),
                    pass: Deno.env.get('GMAIL_PASS'),
                },
            });

            const totalAmount = todaysRecords.reduce((sum, r) => sum + Number(r.amount), 0);

            await transporter.sendMail({
                from: `"${branchName} Team" <${Deno.env.get('GMAIL_USER')}>`,
                to: config.recipient,
                cc: config.cc,
                subject: `Refuel Report ${branchName} - ${todayDateStr} (Auto)`,
                html: `
                <h2>Refuel Report for ${branchName}</h2>
                <p>Date: ${todayDateStr}</p>
                <p>Total Records: ${todaysRecords.length}</p>
                <p>Total Amount: $${totalAmount.toFixed(2)}</p>
                <p>See attached PDF for details.</p>
            `,
                attachments: pdfBuffer ? [{
                    filename: `Refuel_Report_${branchName}_${todayDateStr}.pdf`,
                    content: new Uint8Array(pdfBuffer)
                }] : []
            });

            results.push({ branch: branchName, status: 'Sent', count: todaysRecords.length });
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Func Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

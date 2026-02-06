import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'fs';
import nodemailer from "nodemailer";

export const config = {
    api: {
        bodyParser: false,
    },
};

/**
 * Payload structure for the email report.
 */
export interface EmailPayload {
    to: string;
    cc?: string;
    subject: string;
    message?: string;
    records: any[];
    branchName: string;
    date: string | Date;
    attachments?: { filename: string; content: Buffer }[];
}

/**
 * Core service to format and send the refuel report email.
 * embedded directly in API handler to avoid Vercel module resolution issues with src/ imports
 */
async function sendEmailService(payload: EmailPayload) {
    const { to, cc, subject, message, records, branchName, date, attachments } = payload;

    // Sort records by createdAt (ascending)
    records.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Helper to format time
    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // Build HTML table rows
    const tableRows = records.map((r: any) => `
      <tr>
        <td>${r.reservationNumber}</td>
        <td>${r.rego}</td>
        <td>${r.addedToRCM ? 'Yes' : 'No'}</td>
        <td>$${r.amount.toFixed(2)}</td>
        <td>${r.refuelledBy}</td>
        <td>${formatTime(r.createdAt)}</td>
      </tr>
    `).join("");

    const reportDate = new Date(date);
    const dateStr = reportDate.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const html = `
    <p>Dear Team,</p>
    <p>Please find the refuel list for <b>${branchName}</b> on <b>${dateStr}</b>.</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse; width: 100%; max-width: 800px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="text-align: left;">Reservation</th>
          <th style="text-align: left;">Registration</th>
          <th style="text-align: left;">RCM Status</th>
          <th style="text-align: left;">Amount</th>
          <th style="text-align: left;">Refuelled By</th>
          <th style="text-align: left;">Time</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    ${message ? `
    <div style="margin-top: 20px;">
      <p><b>Notes:</b></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    </div>` : ''}
    <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 6px;">
      <p style="margin: 0;"><b>Summary:</b></p>
      <p style="margin: 5px 0;">Total Records: ${records.length}</p>
      <p style="margin: 5px 0;">Total Amount: <b>$${records.reduce((sum: number, r: any) => sum + r.amount, 0).toFixed(2)}</b></p>
      <p style="margin: 5px 0;">Added to RCM: ${records.filter((r: any) => r.addedToRCM).length}</p>
    </div>
    <p style="margin-top: 30px; color: #6b7280; font-size: 0.9em;">Best regards,<br>${branchName} Team</p>
  `;

    // Nodemailer setup
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
    });

    // Send email
    await transporter.sendMail({
        from: `"${branchName} Team" <${process.env.GMAIL_USER}>`,
        to,
        cc: cc && cc.trim() !== '' ? cc.split(',').map((email: string) => email.trim()) : undefined,
        subject,
        html,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const form = formidable({});

    try {
        const [fields, files] = await form.parse(req);

        // Helper to get single value from unknown field type
        const getField = (key: string): string => {
            const val = fields[key];
            if (Array.isArray(val)) return val[0] || '';
            return val || '';
        };

        const to = getField('to');
        const subject = getField('subject');

        if (!to || !subject) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Parse records JSON
        let records: any[] = [];
        try {
            records = JSON.parse(getField('records') || '[]');
        } catch (e) {
            console.error('[Vercel Email] Failed to parse records JSON');
        }

        const attachments: { filename: string; content: Buffer }[] = [];
        const fileItems = files.attachments;

        if (fileItems) {
            const items = Array.isArray(fileItems) ? fileItems : [fileItems];
            for (const file of items) {
                if (file && file.filepath) {
                    attachments.push({
                        filename: file.originalFilename || 'attachment',
                        content: fs.readFileSync(file.filepath)
                    });
                }
            }
        }

        const payload: EmailPayload = {
            to,
            cc: getField('cc'),
            subject,
            message: getField('message'),
            branchName: getField('branchName'),
            date: getField('date') || new Date().toISOString(),
            records,
            attachments
        };

        await sendEmailService(payload);

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Error in Vercel function:', error.message);
        return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
}

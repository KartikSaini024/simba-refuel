import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { sendEmailService, EmailPayload } from '../src/lib/email-service'; // Import without .ts extension
import fs from 'fs';

export const config = {
    api: {
        bodyParser: false,
    },
};

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

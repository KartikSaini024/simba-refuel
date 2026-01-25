import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
import type { Plugin, ViteDevServer } from 'vite';
import formidable from 'formidable';
import fs from 'fs';
import { sendEmailService, EmailPayload } from '../src/lib/email-service'; // Import source TS directly

export default function emailServerPlugin(): Plugin {
    return {
        name: 'vite-email-server',
        configureServer(server: ViteDevServer) {
            console.log('[Vite Email Plugin] Loaded.');
            console.log('[Vite Email Plugin] GMAIL_USER present:', !!process.env.GMAIL_USER);
            console.log('[Vite Email Plugin] GMAIL_PASS present:', !!process.env.GMAIL_PASS);

            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/send-email' && req.method === 'POST') {
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
                            res.statusCode = 400;
                            res.end(JSON.stringify({ error: 'Missing required fields' }));
                            return;
                        }

                        // Parse records JSON
                        let records: any[] = [];
                        try {
                            records = JSON.parse(getField('records') || '[]');
                        } catch (e) {
                            console.error('[Vite Email] Failed to parse records JSON');
                        }

                        // Process attachments
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

                        // Construct payload
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

                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true }));

                    } catch (err: any) {
                        console.error('[Vite Email Plugin] Error:', err.message);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: err.message }));
                    }
                } else {
                    next();
                }
            });
        },
    };
}

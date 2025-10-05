// api/sendReportEmail.ts
import nodemailer from "nodemailer";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // Required for FormData
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Error parsing form data", details: err });

    try {
      // Normalize fields from FormData (they may come as arrays)
      const to = Array.isArray(fields.to) ? fields.to[0] : fields.to;
      const ccValue = Array.isArray(fields.cc) ? fields.cc[0] : fields.cc;
      const subject = Array.isArray(fields.subject) ? fields.subject[0] : fields.subject;
      const message = Array.isArray(fields.message) ? fields.message[0] : fields.message;
      const branchName = Array.isArray(fields.branchName) ? fields.branchName[0] : fields.branchName;
      const date = Array.isArray(fields.date) ? fields.date[0] : fields.date;
      const records = fields.records ? JSON.parse(Array.isArray(fields.records) ? fields.records[0] : fields.records) : [];

      if (!to || !subject || !records || !branchName || !date) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Normalize CC list
      const ccList = ccValue && ccValue.trim() !== "" ? ccValue.split(",").map((e: string) => e.trim()) : undefined;

      // Normalize attachments
      const attachmentsArray = files.attachments
        ? Array.isArray(files.attachments)
          ? files.attachments
          : [files.attachments]
        : [];

      // Build HTML table
      // Sort records by createdAt (ascending)
      records.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Build HTML table
      const tableRows = records
        .map((r: any) => {
          const timeStr = new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          return `
            <tr>
              <td>${r.reservationNumber}</td>
              <td>${r.rego}</td>
              <td>${r.addedToRCM ? "Yes" : "No"}</td>
              <td>$${r.amount.toFixed(2)}</td>
              <td>${r.refuelledBy}</td>
              <td>${timeStr}</td>
            </tr>
          `;
        })
        .join("");

      // Use first record's createdAt for report date
      const reportDate = records.length > 0 ? new Date(records[0].createdAt) : new Date(date);
      const dateStr = reportDate.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const html = `
        <p>Dear Team,</p>
        <p>Please find the refuel list for <b>${branchName}</b> on <b>${dateStr}</b>.</p>
        <table border="1" cellpadding="6" style="border-collapse:collapse;">
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Registration</th>
              <th>RCM Status</th>
              <th>Amount</th>
              <th>Refuelled By</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${message ? `<p><b>Notes:</b></p><p>${message}</p>` : ""}
        <p><b>Summary:</b><br>
          Total Records: ${records.length}<br>
          Total Amount: $${records.reduce((sum: number, r: any) => sum + r.amount, 0).toFixed(2)}<br>
          Added to RCM: ${records.filter((r: any) => r.addedToRCM).length}
        </p>
        <p>Best regards,<br>${branchName} Team</p>
      `;

      // Nodemailer setup
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
      });

      await transporter.sendMail({
        from: `"${branchName} Team" <${process.env.GMAIL_USER}>`,
        to,
        cc: ccList,
        subject,
        html,
        attachments: attachmentsArray.map((file: any) => ({
          filename: file.originalFilename,
          content: fs.createReadStream(file.filepath),
        })),
      });

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Error sending email:", err);
      return res.status(500).json({ error: "Failed to send email", details: err.message });
    }
  });
}

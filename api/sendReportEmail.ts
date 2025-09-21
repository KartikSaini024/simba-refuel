// api/sendReportEmail.ts
import nodemailer from "nodemailer";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // Important: disable default parser for FormData
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
      // Extract fields
      const { to, cc, subject, message, records, branchName, date } = fields;

      if (!to || !subject || !records || !branchName || !date) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const parsedRecords = JSON.parse(records as string);

      // Normalize CC (could be array from FormData)
      const ccValue = Array.isArray(cc) ? cc[0] : cc;
      const ccList = ccValue && ccValue.trim() !== "" ? ccValue.split(",").map((e: string) => e.trim()) : undefined;

      // Normalize attachments
      const attachmentsArray = files.attachments
        ? Array.isArray(files.attachments)
          ? files.attachments
          : [files.attachments]
        : [];

      // Build HTML table
      const tableRows = parsedRecords
        .map(
          (r: any) => `
        <tr>
          <td>${r.reservationNumber}</td>
          <td>${r.rego}</td>
          <td>${r.addedToRCM ? "Yes" : "No"}</td>
          <td>$${r.amount.toFixed(2)}</td>
          <td>${r.refuelledBy}</td>
          <td>${new Date(r.createdAt).toLocaleTimeString()}</td>
        </tr>
      `
        )
        .join("");

      const html = `
        <p>Dear Team,</p>
        <p>Please find the refuel list for <b>${branchName}</b> on <b>${date}</b>.</p>
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
          Total Records: ${parsedRecords.length}<br>
          Total Amount: $${parsedRecords.reduce((sum: number, r: any) => sum + r.amount, 0).toFixed(2)}<br>
          Added to RCM: ${parsedRecords.filter((r: any) => r.addedToRCM).length}
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

      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Error sending email:", err);
      res.status(500).json({ error: "Failed to send email", details: err.message });
    }
  });
}

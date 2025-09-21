// api/sendReportEmail.ts
import nodemailer from "nodemailer";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, cc, subject, message, records, branchName, date, attachments } = req.body;

  if (!to || !subject || !records || !branchName || !date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Build HTML table
  const tableRows = records.map((r: any) => `
    <tr>
      <td>${r.reservationNumber}</td>
      <td>${r.rego}</td>
      <td>${r.addedToRCM ? "Yes" : "No"}</td>
      <td>$${r.amount.toFixed(2)}</td>
      <td>${r.refuelledBy}</td>
      <td>${new Date(r.createdAt).toLocaleTimeString()}</td>
    </tr>
  `).join("");

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
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    ${message && `<p><b>Notes:</b></p><p>${message}</p>`}
    <p><b>Summary:</b><br>
      Total Records: ${records.length}<br>
      Total Amount: $${records.reduce((sum: number, r: any) => sum + r.amount, 0).toFixed(2)}<br>
      Added to RCM: ${records.filter((r: any) => r.addedToRCM).length}
    </p>
    <p>Best regards,<br>${branchName} Team</p>
  `;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${branchName} Team" <${process.env.GMAIL_USER}>`,
      to,
      cc: cc && cc.trim() !== "" ? cc.split(",").map((email: string) => email.trim()) : undefined,
      subject,
      html,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Error sending email:", err);
    return res.status(500).json({ error: "Failed to send email", details: err.message });
  }
}

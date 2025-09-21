// api/sendReportEmail.ts
import nodemailer from "nodemailer";

export const config = {
  api: {
    bodyParser: false, // disable default body parsing for FormData
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read FormData manually
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const text = buffer.toString();
    
    // Parse fields manually from FormData-like string
    // This is a basic hacky parser for simple string fields (not binary attachments)
    const getField = (name: string) => {
      const match = text.match(new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n`));
      return match ? match[1].trim() : undefined;
    };

    const to = getField("to");
    const cc = getField("cc");
    const subject = getField("subject");
    const message = getField("message");
    const branchName = getField("branchName");
    const date = getField("date");
    const recordsStr = getField("records");
    const records = recordsStr ? JSON.parse(recordsStr) : [];

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
      ${message ? `<p><b>Notes:</b></p><p>${message}</p>` : ""}
      <p><b>Summary:</b><br>
        Total Records: ${records.length}<br>
        Total Amount: $${records.reduce((sum: number, r: any) => sum + r.amount, 0).toFixed(2)}<br>
        Added to RCM: ${records.filter((r: any) => r.addedToRCM).length}
      </p>
      <p>Best regards,<br>${branchName} Team</p>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"${branchName} Team" <${process.env.GMAIL_USER}>`,
      to,
      cc: cc && cc.trim() !== "" ? cc.split(",").map((e: string) => e.trim()) : undefined,
      subject,
      html,
      // attachments handling skipped; needs parsing of binary chunks
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Error sending email:", err);
    return res.status(500).json({ error: "Failed to send email", details: err.message });
  }
}

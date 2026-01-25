import nodemailer from "nodemailer";

export async function sendReportEmail({ to, cc, subject, message, records, branchName, date, attachments }: any) {
    // Sort records by createdAt (ascending)
    records.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Build HTML table
    const tableRows = records.map((r: any) => {
        const timeStr = new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        return `
      <tr>
        <td>${r.reservationNumber}</td>
        <td>${r.rego}</td>
        <td>${r.addedToRCM ? 'Yes' : 'No'}</td>
        <td>$${r.amount.toFixed(2)}</td>
        <td>${r.refuelledBy}</td>
        <td>${timeStr}</td>
      </tr>
    `;
    }).join("");

    const reportDate = new Date(records[0].createdAt);

    const dateStr = new Date(reportDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    ${message && `
    <p><b>Notes:</b></p>
    <p>${message}</p>`}
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

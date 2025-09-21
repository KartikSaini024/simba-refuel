import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import { sendReportEmail } from "./server/sendReportEmail.ts";

dotenv.config({ path: ".env.local" }); // explicitly load env.local

const app = express();
const upload = multer();

// Enable CORS for all origins (or restrict to your frontend)
app.use(cors({
  origin: "http://localhost:8080", // allow your Vite frontend
}));

app.use(express.json());

app.post("/api/sendReportEmail", upload.array('attachments'), async (req, res) => {
  try {
    // Parse JSON fields from FormData
    const { to, cc, subject, message, branchName, date } = req.body;
    const records = JSON.parse(req.body.records || '[]');
    // Prepare attachments for nodemailer
    const attachments = (req.files || []).map(file => ({
      filename: file.originalname,
      content: file.buffer,
    }));
    await sendReportEmail({ to, cc, subject, message, records, branchName, date, attachments });
    res.json({ success: true });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.listen(5000, () => console.log("Backend running at http://localhost:5000"));

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { sendReportEmail } from "./server/sendReportEmail.ts";

dotenv.config();

const app = express();

// Enable CORS for all origins (or restrict to your frontend)
app.use(cors({
  origin: "http://localhost:8080", // allow your Vite frontend
}));

app.use(express.json());

app.post("/api/sendReportEmail", async (req, res) => {
  try {
    await sendReportEmail(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.listen(5000, () => console.log("Backend running at http://localhost:5000"));

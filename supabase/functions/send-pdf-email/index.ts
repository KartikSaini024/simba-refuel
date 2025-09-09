import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  attachmentBase64: string;
  attachmentName: string;
  branchName: string;
  date: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, attachmentBase64, attachmentName, branchName, date }: EmailRequest = await req.json();

    console.log(`Sending PDF email to ${to} for ${branchName} on ${date}`);

    const emailResponse = await resend.emails.send({
      from: "Simba Refuel Report <reports@resend.dev>",
      to: [to],
      subject: subject || `Refuel Report - ${branchName} - ${date}`,
      html: `
        <h2>Refuel Report - ${branchName}</h2>
        <p>Date: ${date}</p>
        <p>Please find the attached refuel report for your review.</p>
        <br>
        <p>Best regards,<br>Simba Car Rentals</p>
      `,
      attachments: [
        {
          filename: attachmentName,
          content: attachmentBase64,
        }
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
import { json } from "@remix-run/node";
import nodemailer from "nodemailer";
import { authenticate } from "../shopify.server";
import { cors } from "remix-utils/cors";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT), 
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, 
  },
  connectionTimeout: 10000, 
  greetingTimeout: 10000,
  socketTimeout: 10000,
});


transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ SMTP Connection Error:', error);
  } else {
    console.log('✅ SMTP Server is ready to send emails');
  }
});

export async function action({ request }) {
 
   const { admin } = await authenticate.admin(request);
  try {
    const data = await request.json();
    console.log("datadata",data)
    
    const { to = data.recipientEmail, subject, text, html = data.htmlTemplate } = data;
    console.log("totototototo",to)
   if (!to) {
      return cors(
        request,
        json({ error: "Recipient email is required" }, { status: 400 })
      );
    }

    let info = await transporter.sendMail({
      from: `"AutoNotify - Restock Alert" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || "Hello ✔",
      text: text || "Hello world?",
      html: html || "<b>Hello world?</b>",
    });
    console.log("infoinfoinfoinfo",info)

    return cors(
      request,
      json({ success: true, messageId: info.messageId })
    );
  } catch (err) {
    console.error("Error sending mail:", err);
   return cors(
      request,
      json({ success: false, error: err.message }, { status: 500 })
    );
  }
}

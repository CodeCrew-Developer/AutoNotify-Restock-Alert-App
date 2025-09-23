import { json } from "@remix-run/node";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { authenticate } from "../shopify.server";


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
export async function action({ request }) {
   const { admin } = await authenticate.admin(request);
  try {
    const data = await request.json();
    
    const { to = data.recipientEmail, subject, text, html = data.htmlTemplate } = data;

    if (!to) {
      return json({ error: "Recipient email is required" }, { status: 400 });
    }

    let info = await transporter.sendMail({
      from: `"AutoNotify - Restock Alert" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || "Hello ✔",
      text: text || "Hello world?",
      html: html || "<b>Hello world?</b>",
    });

    return json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error("Error sending mail:", err);
    return json({ success: false, error: err.message }, { status: 500 });
  }
}

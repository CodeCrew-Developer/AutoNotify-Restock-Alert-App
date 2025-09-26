import { json } from "@remix-run/node";
import nodemailer from "nodemailer";
import { cors } from "remix-utils/cors";
import { authenticate } from "../shopify.server";

const transporter = nodemailer.createTransporter({
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
      return await cors(
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

    return await cors(
      request,
      json({ success: true, messageId: info.messageId })
    );
  } catch (err) {
    console.error("Error sending mail:", err);
    return await cors(
      request,
      json({ success: false, error: err.message }, { status: 500 })
    );
  }
}
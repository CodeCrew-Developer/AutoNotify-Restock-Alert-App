import { json } from "@remix-run/node";
import nodemailer from "nodemailer";
import { authenticate } from "../shopify.server";
import { cors } from "remix-utils/cors";

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

    const { recipientEmail, subject, text, htmlTemplate } = data;
    const to = recipientEmail;
    const html = htmlTemplate;

    if (!to) {
      return cors(
        request,
        json({ success: false, message: "Recipient email is required" }, { status: 400 })
      );
    }

    let info = await transporter.sendMail({
      from: `"AutoNotify - Restock Alert" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || "Hello ✔",
      text: text || "Hello world?",
      html: html || "<b>Hello world?</b>",
    });

    return cors(request, json({ success: true, messageId: info.messageId }));
  } catch (err) {
    console.error("Error sending mail:", err);
    return cors(
      request,
      json({ success: false, message: err.message }, { status: 500 })
    );
  }
}


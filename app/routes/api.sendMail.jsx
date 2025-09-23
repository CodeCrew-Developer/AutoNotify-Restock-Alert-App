import { json } from "@remix-run/node";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

const myEnv = {};
dotenv.config({ processEnv: myEnv });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: myEnv.EMAIL_USER,
    pass: myEnv.EMAIL_PASS,
  },
});
export async function action({ request }) {
  try {
    const data = await request.json();
    
    const { to = data.recipientEmail, subject, text, html = data.htmlTemplate } = data;

    if (!to) {
      return json({ error: "Recipient email is required" }, { status: 400 });
    }

    let info = await transporter.sendMail({
      from: `"AutoNotify - Restock Alert" <${myEnv.EMAIL_USER}>`,
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

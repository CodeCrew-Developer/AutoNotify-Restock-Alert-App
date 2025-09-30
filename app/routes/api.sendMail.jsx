// app/routes/api.sendMail.js
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { cors } from "remix-utils/cors";

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return cors(request, json({}));
  }
  return json({ error: "Method not allowed" }, { status: 405 });
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return cors(request, json({}));
  }

  try {
    let admin;
    try {
      const auth = await authenticate.admin(request);
      admin = auth.admin;
    } catch (authError) {
      console.log("⚠️ Authentication skipped for internal call");
    }

    const data = await request.json();
    console.log("📧 Received mail request:", { 
      to: data.recipientEmail || data.to,
      subject: data.subject 
    });

    const to = data.recipientEmail || data.to;
    const subject = data.subject;
    const html = data.htmlTemplate || data.html;

    // ✅ Required field validation
    if (!to || !subject || !html) {
      console.error("❌ Missing required fields:", { to: !!to, subject: !!subject, html: !!html });
      return cors(
        request,
        json(
          { 
            success: false,
            error: "Fields 'to' (or 'recipientEmail'), 'subject' and 'html' (or 'htmlTemplate') are required" 
          },
          { status: 400 }
        )
      );
    }

    const mailApiUrl = process.env.MAILBASE_URL + "/api/auto-notify/sendMail";
    console.log("📤 Sending to mail API:", mailApiUrl);

    const response = await fetch(mailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.MAIL_API_KEY || "abcd1234"
      },
      body: JSON.stringify({ to, subject, html }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Mail API failed:", response.status, errText);
      throw new Error(`Mail API failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    console.log("✅ Mail sent successfully to:", to);

    return cors(
      request,
      json({ success: true, result })
    );
  } catch (err) {
    console.error("❌ Error in sendMail action:", err);
    return cors(
      request,
      json({ success: false, error: err.message }, { status: 500 })
    );
  }
}
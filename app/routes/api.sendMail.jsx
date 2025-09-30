import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { cors } from "remix-utils/cors";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const data = await request.json();
    // console.log("datadata", data);

    const { to = data.recipientEmail, subject, html = data.htmlTemplate } = data;
    // console.log("totototototo", to);

    // ✅ Required field validation
    if (!to || !subject || !html) {
      return cors(
        request,
        json(
          { error: "Fields 'to', 'subject' and 'html' are required" },
          { status: 400 }
        )
      );
    }

    // ✅ Call external API instead of nodemailer
    const response = await fetch(
      process.env.MAILBASE_URL+"/api/auto-notify/sendMail",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "abcd1234"
        },
        body: JSON.stringify({ to, subject, html }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Mail API failed: ${errText}`);
    }

    const result = await response.json();
    // console.log("mail api response", result);

    return cors(
      request,
      json({ success: true, result })
    );
  } catch (err) {
    console.error("Error sending mail:", err);
    return cors(
      request,
      json({ success: false, error: err.message }, { status: 500 })
    );
  }
}

import { json } from "@remix-run/node";
import fs from "fs";
import path from "path";

export async function action({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return json({ error: "No file uploaded" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    
    // Store only the relative path
    const relativePath = `uploads/${fileName}`;

    return json({ success: true, url: relativePath });
  } catch (error) {
    console.error("File upload error:", error);
    return json({ error: "Upload failed" }, { status: 500 });
  }
}
import users from "../modes/users";
import { ShopSettings } from "../modes/users";
import { cors } from "remix-utils/cors";
import { json } from "@remix-run/node";

export async function loader({ request }) {
  

       if (request.method === "OPTIONS") {
         console.log("loader request.method",request.method)
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Or your shop domain
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
       }

  const url = new URL(request.url);
  const shopName = url.searchParams.get("shopName");

  try {
    let data;
    console.log("dataaaaaaaaaa",data)
    if (shopName) {
      data = await users.find({ shopName: shopName });
    } else {
      data = await users.find();
    }

    let shopSettings = null;
    if (shopName) {
      shopSettings = await ShopSettings.findOne({ shopName: shopName });
    }

    return await cors(
      request,
      json({
        users: data,
        shopSettings: shopSettings,
      }),
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch users",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  }
}

export async function action({ request }) {
 
  console.log("request.method",request.method)
  if (request.method === "OPTIONS") {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Or your shop domain
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

  try {
    const data = await request.json();

    // Handle email flag update
    if (data.action === "updateEmailFlag") {
      const { email, productId, variantId, shopName, emailSent } = data;

      if (
        !email ||
        !productId ||
        !variantId ||
        !shopName ||
        emailSent === undefined
      ) {
        return new Response(
          JSON.stringify({
            error:
              "Email, productId, variantId, shopName, and emailSent are required for flag update",
          }),
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Update the user's emailSent flag
      const updatedUser = await users.findOneAndUpdate(
        {
          email: email.toLowerCase().trim(),
          productId: productId.toString().trim(),
          variantId: variantId.toString().trim(),
          shopName: shopName.toString(),
        },
        {
          emailSent: emailSent,
        },
        {
          new: true,
        }
      );

      if (!updatedUser) {
        return new Response(
          JSON.stringify({
            error: "User not found",
            message: "No user found with the provided criteria",
          }),
          {
            status: 404,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
          }
        );
      }

      console.log(
        "Email flag updated for user:",
        JSON.stringify(updatedUser, null, 2)
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email flag updated successfully",
          user: updatedUser,
        }),
        {
          status: 200,
          headers: {
            ...getCorsHeaders(),
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Handle shop settings update
    if (data.action === "updateShopSettings") {
      const { shopName, autoEmailGloballyEnabled, webhookActive } = data;

      if (!shopName) {
        return new Response(
          JSON.stringify({
            error: "Shop name is required for settings update",
          }),
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Update or create shop settings
      const shopSettings = await ShopSettings.findOneAndUpdate(
        { shopName: shopName },
        {
          autoEmailGloballyEnabled: autoEmailGloballyEnabled,
          webhookActive: webhookActive,
        },
        {
          upsert: true, // Create if doesn't exist
          new: true, // Return updated document
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "Shop settings updated successfully",
          shopSettings: shopSettings,
        }),
        {
          status: 200,
          headers: {
            ...getCorsHeaders(),
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ✅ Required fields check
    const requiredFields = ["email", "productId", "variantId", "shopName"];
    const missing = requiredFields.filter(
      (f) => !data[f] || data[f].toString().trim() === ""
    );

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          missingFields: missing,
        }),
        {
          status: 400,
          headers: {
            ...getCorsHeaders(),
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ✅ Normalize + set default emailSent flag
    const userData = {
      email: data.email.toLowerCase().trim(),
      productId: data.productId.toString().trim(),
      variantId: data.variantId.toString().trim(),
      shopName: data.shopName,
      emailSent: 0,
      createdAt: data.createdAt || new Date().toISOString(),
    };

    console.log("🆕 Creating user:", JSON.stringify(userData, null, 2));
    const newUser = await users.create(userData);

    return await cors(
      request,
      json({
        success: true,
        message: "Notification request received successfully",
        data: newUser,
      }),
    );
  } catch (error) {
    console.error("❌ Error in POST:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  }
}
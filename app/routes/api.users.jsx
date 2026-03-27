import users from "../modes/users";
import { ShopSettings } from "../modes/users";
import { cors } from "remix-utils/cors";

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  let url = new URL(request.url);
  let shopDomain = url.searchParams.get("shopDomain");

  try {
    let data, shopSettings;

    if (shopDomain) {
      // 🔹 Match exact shop name (no normalization)
      data = await users.find({ shopDomain });
      shopSettings = await ShopSettings.findOne({ shopDomain });
    } else {
      data = await users.find();
      shopSettings = null;
    }

    const response = {
      users: data || [],
      shopSettings: shopSettings || {},
    };

    return cors(
      request,
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (error) {
    console.error("Error in loader:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function action({ request }) {
  // ✅ Handle OPTIONS for CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const data = await request.json();

    // ✅ Handle PATCH for email flag update
    if (request.method === "PATCH" || data.action === "updateEmailFlag") {
      const { email, productId, variantId, shopDomain, emailSent, emailStatus, messageId } = data;

      if (
        !email ||
        !productId ||
        !variantId ||
        !shopDomain
      ) {
        return cors(
          request,
          new Response(
            JSON.stringify({
              error:
                "Email, productId, variantId, and shopDomain are required for flag update",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      const updateData = {
        updatedAt: new Date().toISOString(),
      };

      if (emailSent !== undefined) updateData.emailSent = emailSent; // backward compatibility
      if (emailStatus) updateData.emailStatus = emailStatus;
      if (messageId) updateData.messageId = messageId;

      const updatedUser = await users.findOneAndUpdate(
        {
          email: email.toLowerCase().trim(),
          productId: productId.toString().trim(),
          variantId: variantId.toString().trim(),
          shopDomain, // 🔹 exact match only
        },
        updateData,
        { new: true },
      );

      if (!updatedUser) {
        console.error("❌ User not found for update:", {
          email,
          productId,
          variantId,
          shopDomain,
        });

        return cors(
          request,
          new Response(
            JSON.stringify({
              error: "User not found",
              message: "No user found with the provided criteria",
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      console.log("✅ Email flag updated successfully:", {
        email: updatedUser.email,
        newEmailSent: updatedUser.emailSent,
      });

      return cors(
        request,
        new Response(
          JSON.stringify({
            success: true,
            message: "Email flag updated successfully",
            user: updatedUser,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    // ✅ Handle shop settings update
    if (data.action === "updateShopSettings") {
      const { shopDomain, autoEmailGloballyEnabled, webhookActive } = data;

      if (!shopDomain) {
        return cors(
          request,
          new Response(
            JSON.stringify({
              error: "Shop Domain is required for settings update",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      const shopSettings = await ShopSettings.findOneAndUpdate(
        { shopDomain },
        {
          autoEmailGloballyEnabled,
          webhookActive,
        },
        {
          upsert: true,
          new: true,
        },
      );

      return cors(
        request,
        new Response(
          JSON.stringify({
            success: true,
            message: "Shop settings updated successfully",
            shopSettings,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    // ✅ Handle POST - Create new user
    const requiredFields = ["email", "productId", "variantId", "shopDomain"];
    const missing = requiredFields.filter(
      (f) => !data[f] || data[f].toString().trim() === "",
    );

    if (missing.length > 0) {
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: "Missing required fields",
            missingFields: missing,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    const userData = {
      email: data.email.toLowerCase().trim(),
      productId: data.productId.toString().trim(),
      productTitle: data.productTitle.toString().trim(),
      variantId: data.variantId.toString().trim(),
      shopDomain: data.shopDomain, // 🔹 store full name exactly as passed
      emailSent: 0,
      createdAt: data.createdAt || new Date().toISOString(),
    };

    console.log("🆕 Creating/Updating user:", userData);

    const newUser = await users.findOneAndUpdate(
      {
        email: userData.email,
        productId: userData.productId,
        variantId: userData.variantId,
        shopDomain: userData.shopDomain, // exact match
      },
      { 
        $setOnInsert: {
          productTitle: userData.productTitle,
          createdAt: userData.createdAt,
        },
        $set: {
          emailStatus: "pending",
          emailSent: 0
        },
        $unset: {
          messageId: 1
        }
      },
      { upsert: true, new: true },
    );

    return cors(
      request,
      new Response(
        JSON.stringify({
          success: true,
          message: "Notification request processed successfully",
          data: newUser,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  } catch (error) {
    console.error("❌ Error in action:", error);
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }
}

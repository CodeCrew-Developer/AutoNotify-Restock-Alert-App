import users from "../modes/users";
import { ShopSettings } from "../modes/users";
import { cors } from "remix-utils/cors";

const normalizeShopName = (shop) => shop.toLowerCase().trim();

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
  let shopName = url.searchParams.get("shopName");

  try {
    let data, shopSettings;

    if (shopName) {
      const normalized = normalizeShopName(shopName);

      data = await users.find({
        shopName: new RegExp(`^${normalized}$`, "i"),
      });

      shopSettings = await ShopSettings.findOne({
        shopName: new RegExp(`^${normalized}$`, "i"),
      });
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
      const { email, productId, variantId, shopName, emailSent } = data;

      if (
        !email ||
        !productId ||
        !variantId ||
        !shopName ||
        emailSent === undefined
      ) {
        return cors(
          request,
          new Response(
            JSON.stringify({
              error:
                "Email, productId, variantId, shopName, and emailSent are required for flag update",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      // ✅ Normalize and trim all values for matching
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedProductId = productId.toString().trim();
      const normalizedVariantId = variantId.toString().trim();
      const normalizedShopName = shopName.toString().trim();

      // ✅ First, find the user to debug
      const existingUser = await users.findOne({
        email: normalizedEmail,
        productId: normalizedProductId,
        variantId: normalizedVariantId,
        shopName: new RegExp(`^${normalizedShopName}$`, "i"),
      });

      if (existingUser) {
        console.log("👤 User details:", {
          _id: existingUser._id,
          email: existingUser.email,
          productId: existingUser.productId,
          variantId: existingUser.variantId,
          shopName: existingUser.shopName,
          currentEmailSent: existingUser.emailSent,
        });
      }

      // ✅ Update the user's emailSent flag with case-insensitive shop name
      const updatedUser = await users.findOneAndUpdate(
        {
          email: normalizedEmail,
          productId: normalizedProductId,
          variantId: normalizedVariantId,
          shopName: new RegExp(`^${normalizedShopName}$`, "i"),
        },
        {
          emailSent: emailSent,
          updatedAt: new Date().toISOString(),
        },
        {
          new: true,
        },
      );

      if (!updatedUser) {
        console.error("❌ User not found for update. Attempted with:", {
          email: normalizedEmail,
          productId: normalizedProductId,
          variantId: normalizedVariantId,
          shopName: normalizedShopName,
        });

        return cors(
          request,
          new Response(
            JSON.stringify({
              error: "User not found",
              message: "No user found with the provided criteria",
              searchedWith: {
                email: normalizedEmail,
                productId: normalizedProductId,
                variantId: normalizedVariantId,
                shopName: normalizedShopName,
              },
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
      const { shopName, autoEmailGloballyEnabled, webhookActive } = data;

      if (!shopName) {
        return cors(
          request,
          new Response(
            JSON.stringify({
              error: "Shop name is required for settings update",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      const shopSettings = await ShopSettings.findOneAndUpdate(
        { shopName: shopName },
        {
          autoEmailGloballyEnabled: autoEmailGloballyEnabled,
          webhookActive: webhookActive,
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
            shopSettings: shopSettings,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    // ✅ Handle POST - Create new user
    // ✅ Handle POST - Create new user
    const requiredFields = ["email", "productId", "variantId", "shopName"];
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
      variantId: data.variantId.toString().trim(),
      shopName: normalizeShopName(data.shopName),
      emailSent: 0,
      createdAt: data.createdAt || new Date().toISOString(),
    };

    console.log("🆕 Creating/Updating user:", userData);

    // ✅ Prevent duplicate error by using upsert
    const newUser = await users.findOneAndUpdate(
      {
        email: userData.email,
        productId: userData.productId,
        variantId: userData.variantId,
        shopName: userData.shopName,
      },
      { $setOnInsert: userData }, // insert only if not exists
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

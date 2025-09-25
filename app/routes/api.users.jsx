import users from "../modes/users";
import { ShopSettings } from "../modes/users";

export async function loader({ request }) {
  console.log("getttttttttttttttttttttt")
  const url = new URL(request.url);
  const shopName = url.searchParams.get('shopName');

  try {
    let data;
    if (shopName) {
      // Filter users by shop name
      data = await users.find({ shopName: shopName });
    } else {
      // Return all users if no shop name specified
      data = await users.find();
    }

    // Get shop settings for the specific shop
    let shopSettings = null;
    if (shopName) {
      shopSettings = await ShopSettings.findOne({ shopName: shopName });
    }

    return new Response(
      JSON.stringify({
        users: data,
        shopSettings: shopSettings,
      }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch users",
        message: error.message
      }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      },
    );
  }
}

export async function action({ request }) {
  try {
      if (request.method === "OPTIONS") {
        const origin = request.headers.get("origin");
      // ✅ Handle CORS preflight properly
      return new Response(null, {
        status: 200,
        headers: {
           "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }
    const data = await request.json();
   

    // Handle email flag update
    if (data.action === 'updateEmailFlag') {
      const { email, productId, variantId, shopName, emailSent } = data;
      
      if (!email || !productId || !variantId || !shopName || emailSent === undefined) {
        return new Response(
          JSON.stringify({
            error: "Email, productId, variantId, shopName, and emailSent are required for flag update",
          }),
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Headers": "Content-Type",
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
          shopName: shopName.toString()
        },
        { 
          emailSent: emailSent 
        },
        { 
          new: true 
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
              "Access-Control-Allow-Headers": "Content-Type",
              "Content-Type": "application/json",
            },
          }
        );
      }

      console.log('Email flag updated for user:', JSON.stringify(updatedUser, null, 2));

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email flag updated successfully",
          user: updatedUser,
        }),
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Handle shop settings update
    if (data.action === 'updateShopSettings') {
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
              "Access-Control-Allow-Headers": "Content-Type",
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
          webhookActive: webhookActive 
        },
        { 
          upsert: true, // Create if doesn't exist
          new: true // Return updated document
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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json",
          },
        },
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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification request received successfully",
        data: newUser,
      }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": "application/json",
        },
      }
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
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": "application/json",
        },
      }
    );
  }
}
import { json } from "@remix-run/node";
import prisma from "../db.server";

const recentlyNotified = new Map();
const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;
let lastNotifiedUsers = [];

export const loader = async () => {
  return json(
    { lastNotifiedUsers },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    },
  );
};

export async function action({ request }) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop)
      return json(
        { message: "Inventory update received" },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        },
      );

    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      throw new Error(`No session found for shop: ${shop}`);
    }

    const data = await request.json();
    const updates = Array.isArray(data) ? data : [data];

    const restockedVariants = [];
for (const item of updates) {
      const key = `${item.inventory_item_id}-${item.location_id}`;
      const now = Date.now();
      console.log("recentlyNotifiedrecentlyNotified", recentlyNotified);

      if (
        !recentlyNotified.has(key) ||
        now - recentlyNotified.get(key) > NOTIFY_COOLDOWN_MS
      ) {
        restockedVariants.push(item);
        recentlyNotified.set(key, now);
      } else {
        console.log(
          `⏸ Skipping duplicate variant-level notification for ${key}`,
        );
      }
    }

    if (restockedVariants.length > 0) {
      const notifiedEmails = await sendRestockNotification(
        restockedVariants,
        session.shop,
        session.accessToken,
      );
      lastNotifiedUsers = notifiedEmails;
    }

    return json(
      { message: "Inventory update processed", receivedData: data, shop },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error handling inventory webhook:", error);
    return json({ message: "Error processing webhook" }, { status: 500 });
  }
}

async function sendRestockNotification(restockedVariants, shop, token) {
  if (!shop) {
    throw new Error("❌ Shop name is required to fetch template and users");
  }
  const templateApi = `${process.env.SHOPIFY_APP_URL}/api/email_template?shopDomain=${shop}`;
  const usersApi = `${process.env.SHOPIFY_APP_URL}/api/users?shopDomain=${shop}`;
  // console.log("templateApitemplateApi", templateApi);
  // console.log("usersApiusersApi", usersApi);

  try {
    const usersResponse = await fetch(usersApi);

    if (!usersResponse.ok) {
      console.error(" Users fetch failed:", usersResponse.status);
      throw new Error("Failed to fetch users");
    }

    const usersJson = await usersResponse.json();
    // console.log("usersJsonusersJson111usersJson", usersJson.users);

    const usersArray = usersJson.users || [];
    const shopSettings = usersJson.shopSettings || {};
    // console.log("shopSettings", shopSettings);

    if (!shopSettings.autoEmailGloballyEnabled) {
      console.log(`⚠️ Auto-email is disabled for shop: ${shop}`);
      console.log("🔍 Shop settings:", shopSettings);
      return [];
    }

    // console.log("✅ Auto-email is enabled for shop:", shop);

    // FETCH EMAIL TEMPLATE
    const templateResponse = await fetch(templateApi);

    if (!templateResponse.ok) {
      console.error("❌ Template fetch failed:", templateResponse.status);
      throw new Error("Failed to fetch email template");
    }

    const templateJson = await templateResponse.json();

    const templateData = templateJson?.data?.emailTemplates?.[0];

    if (!templateData) {
      console.error("❌ No email template found for shop:", shop);

      // const allTemplatesResponse = await fetch(
      //   `${process.env.SHOPIFY_APP_URL}/api/email_template`,
      // );
      // if (allTemplatesResponse.ok) {
      //   const allTemplates = await allTemplatesResponse.json();
      //   const availableShops =
      //     allTemplates.data?.emailTemplates?.map((t) => t.shopDomain) || [];
      //   // console.log("📋 Available template shops:", availableShops);
      // }

      throw new Error("No email template found for this shop");
    }

    if (templateData.shopName !== shop) {
      console.error("❌ Template shop mismatch!");
      console.error("   Requested:", shop);
      console.error("   Received:", templateData.shopName);
      throw new Error(
        `Template mismatch: got ${templateData.shopName} instead of ${shop}`,
      );
    }

    // console.log("✅ Template verified for:", templateData.shopName);

    if (usersArray.length === 0) {
      // console.log("🔍 No users found for shop, checking all users...");
      try {
        const allUsersResponse = await fetch(
          `${process.env.SHOPIFY_APP_URL}/api/users`,
        );
        if (allUsersResponse.ok) {
          const allUsersJson = await allUsersResponse.json();
          const allUsers = allUsersJson.users || [];
          const distinctShops = [
            ...new Set(allUsers.map((user) => user.shopDomain)),
          ];
          // console.log("🔍 Distinct shop names in database:", distinctShops);
        }
      } catch (debugError) {
        console.log("🔍 Debug fetch failed:", debugError.message);
      }
    }

    const inventoryToVariantDetails = new Map();
    for (const variant of restockedVariants) {
      const details = await fetchVariantDetailsFromInventoryId(
        variant.inventory_item_id,
        shop,
        token,
      );
      if (details) {
        inventoryToVariantDetails.set(variant.inventory_item_id, details);
      }
    }

    function normalizeVariantId(id) {
      if (!id) return null;
      const match = String(id).match(/(\d+)$/);
      return match ? match[1] : String(id);
    }

    const matchingUsers = usersArray.filter((user) => {
      if (user.emailSent === 1) {
        console.log(
          `⏸ Skipping user ${user.email} - already notified (emailSent: 1)`,
        );
        return false;
      }

      return restockedVariants.some((variant) => {
        const details = inventoryToVariantDetails.get(
          variant.inventory_item_id,
        );
        const normalizedUserId = normalizeVariantId(user.variantId);
        const normalizedVariantId = normalizeVariantId(details?.id);
        return normalizedUserId === normalizedVariantId;
      });
    });

    console.log("🔍 Matching users found:", matchingUsers.length);

    const now = Date.now();
    const recipientEmails = [];
    const usersToUpdate = [];

    for (const user of matchingUsers) {
      const variantId = normalizeVariantId(user.variantId);
      const emailKey = `${variantId}-${user.email}`;

      if (
        !recentlyNotified.has(emailKey) ||
        now - recentlyNotified.get(emailKey) > NOTIFY_COOLDOWN_MS
      ) {
        recentlyNotified.set(emailKey, now);
        recipientEmails.push(user.email);
        usersToUpdate.push(user);
      } else {
        console.log(
          `⏸ Skipping duplicate email to ${user.email} for variant ${variantId}`,
        );
      }
    }

    if (recipientEmails.length === 0) {
      console.log("⚠️ No new recipients after cooldown filtering");
      console.log("🔍 Debug info:", {
        totalUsersFromAPI: usersArray.length,
        matchingUsers: matchingUsers.length,
        restockedVariants: restockedVariants.length,
         shopName: shop,
        autoEmailEnabled: shopSettings.autoEmailGloballyEnabled,
      });
      return [];
    }

    const itemsHtml = restockedVariants
      .map((variant) => {
        const details = inventoryToVariantDetails.get(
          variant.inventory_item_id,
        );
        if (!details) return "";
        return `
      <div class="product-card">
        <div class="product-content">
          <div class="product-image">
            <img src="${details.image || ""}" 
                 alt="${details.title}" 
                 style="width:100%;border-radius:4px;height:100%;"/>
          </div>
          <div class="product-details">
            <h3 class="product-name">${details.title}</h3>
            <p class="product-price">${details.price}</p>
            <p><strong>Now Available:</strong> ${variant.available}</p>
          </div>
        </div>
      </div>
    `;
      })
      .join("");

    const firstVariant = restockedVariants[0];
    const firstDetails = firstVariant
      ? inventoryToVariantDetails.get(firstVariant.inventory_item_id)
      : null;

    let templateHtml = templateData.htmlTemplate;

    templateHtml = templateHtml.replace(
      /<div class="product-section">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/,
      `<div class="product-section">${itemsHtml}</div>`,
    );

    if (firstDetails?.url) {
      templateHtml = templateHtml.replace(
        /<a href="[^"]*" class="button">Buy It Now<\/a>/,
        `<a href="${firstDetails.url}" class="button">Buy It Now</a>`,
      );
    }

    const successfullyNotifiedEmails = [];

    for (let i = 0; i < recipientEmails.length; i++) {
      const email = recipientEmails[i];
      const user = usersToUpdate[i];

      try {
        // console.log(`📧 Attempting to send email to: ${email}`);

        const response = await fetch(
          process.env.SHOPIFY_APP_URL + "/api/sendMail",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              recipientEmail: email,
              subject: templateData.subject,
              html: templateHtml,
            }),
          },
        );

        const responseData = await response.json().catch(() => null);

        if (response.ok) {
          console.log(`✅ Restock notification sent to ${email}`);
          successfullyNotifiedEmails.push(email);
          await updateUserEmailFlag(user, shop);
        } else {
          console.error(`❌ Failed to send to ${email}:`, {
            status: response.status,
            statusText: response.statusText,
            data: responseData,
          });
        }
      } catch (emailError) {
        console.error(`❌ Exception sending to ${email}:`, emailError.message);
      }

      if (i < recipientEmails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return successfullyNotifiedEmails;
  } catch (error) {
    console.error("Error sending restock notification:", error);
    return [];
  }
}

async function updateUserEmailFlag(user, shopDomain) {
  try {
    const updateApi = `${process.env.SHOPIFY_APP_URL}/api/users`;

    const response = await fetch(updateApi, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateEmailFlag",
        email: user.email,
        productId: user.productId,
        variantId: user.variantId,
        shopDomain,
        emailSent: 1,
      }),
    });
    console.log("flag response", response);

    if (response.ok) {
      console.log(`✅ Updated emailSent flag for user ${user.email}`);
    } else {
      console.error(
        `❌ Failed to update emailSent flag for user ${user.email}`,
      );
    }
  } catch (error) {
    console.error(
      `❌ Error updating emailSent flag for user ${user.email}:`,
      error,
    );
  }
}

async function fetchVariantDetailsFromInventoryId(
  inventoryItemId,
  shopDomainName,
  token,
) {
  try {
    const response = await fetch(
      `https://${shopDomainName}/admin/api/2024-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          query: `
            query($id: ID!) {
              inventoryItem(id: $id) {
                variant {
                  id
                  title
                  image {
                    originalSrc
                  }
                  price
                  product {
                    handle
                    title
                    featuredImage {
                      originalSrc
                    }
                  }
                }
              }
            }
          `,
          variables: {
            id: `gid://shopify/InventoryItem/${inventoryItemId}`,
          },
        }),
      },
    );

    const result = await response.json();
    const variant = result?.data?.inventoryItem?.variant;
    if (!variant) return null;

    // placeholder image fallback
    const placeholderImage =
      "https://via.placeholder.com/300?text=No+Image+Available";

    const imageSrc =
      variant.image?.originalSrc ||
      variant.product?.featuredImage?.originalSrc ||
      placeholderImage;

    const variantIdMatch = String(variant.id).match(/(\d+)$/);
    const numericVariantId = variantIdMatch ? variantIdMatch[1] : null;

    const variantUrl = `https://${shopDomainName}/products/${variant.product.handle}?variant=${numericVariantId}`;

    return {
      id: variant.id,
      title: variant.product?.title || variant.title,
      image: imageSrc,
      price: variant.price ? `$${variant.price}` : "",
      url: variantUrl,
    };
  } catch (error) {
    console.error("GraphQL fetchVariantDetails error:", error);
    return null;
  }
}

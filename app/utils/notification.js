
const recentlyNotified = new Map();
const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;

export const manualSendProgress = new Map(); // shopDomain -> { total, current, status }

export async function sendRestockNotification(restockedVariants, shop, token, options = {}) {
  const { isManual = false } = options;
  if (!shop) {
    throw new Error("❌ Shop name is required to fetch template and users");
  }
  const templateApi = `${process.env.SHOPIFY_APP_URL}/api/email_template?shopName=${encodeURIComponent(shop)}`;
  const usersApi = `${process.env.SHOPIFY_APP_URL}/api/users?shopDomain=${shop}`;

  try {
    const usersResponse = await fetch(usersApi);

    if (!usersResponse.ok) {
      console.error(" Users fetch failed:", usersResponse.status);
      throw new Error("Failed to fetch users");
    }

    const usersJson = await usersResponse.json();
    const usersArray = usersJson.users || [];
    const shopSettings = usersJson.shopSettings || {};

    if (!isManual && !shopSettings.autoEmailGloballyEnabled) {
      console.log(`⚠️ Auto-email is disabled for shop: ${shop}`);
      return [];
    }

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
      throw new Error("No email template found for this shop");
    }

    if (templateData.shopName !== shop) {
      console.error("❌ Template shop mismatch!");
      throw new Error(`Template mismatch: got ${templateData.shopName} instead of ${shop}`);
    }

    const variantDetailsPromises = restockedVariants.map((variant) =>
      fetchVariantDetailsFromInventoryId(variant.inventory_item_id, shop, token)
    );
    const variantDetailsResults = await Promise.all(variantDetailsPromises);

    const inventoryToVariantDetails = new Map();
    variantDetailsResults.forEach((details, idx) => {
      if (details) {
        inventoryToVariantDetails.set(restockedVariants[idx].inventory_item_id, details);
      }
    });

    function normalizeVariantId(id) {
      if (!id) return null;
      const match = String(id).match(/(\d+)$/);
      return match ? match[1] : String(id);
    }

    const matchingUsers = usersArray.filter((user) => {
      if (user.emailStatus === "sent" || user.emailSent === 1) {
        return false;
      }

      return restockedVariants.some((variant) => {
        const details = inventoryToVariantDetails.get(variant.inventory_item_id);
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

      if (isManual) {
        // Always push for manual sending
        recipientEmails.push(user.email);
        usersToUpdate.push(user);
        continue;
      }

      const lastNotified = recentlyNotified.get(emailKey);
      if (
        !lastNotified ||
        now - lastNotified > NOTIFY_COOLDOWN_MS
      ) {
        recentlyNotified.set(emailKey, now);
        recipientEmails.push(user.email);
        usersToUpdate.push(user);
      } else {
        console.log(`⏸ Cooldown: Skipping email to ${user.email} (last sent ${Math.round((now - lastNotified) / 1000)}s ago)`);
      }
    }

    if (recipientEmails.length === 0) {
      console.log("⚠️ No new recipients after cooldown filtering");
      if (isManual) {
        manualSendProgress.set(shop, { total: 0, current: 0, status: "completed" });
        setTimeout(() => manualSendProgress.delete(shop), 30000);
      }
      return { sentCount: 0, error: null };
    }

    if (isManual) {
      manualSendProgress.set(shop, { total: recipientEmails.length, current: 0, failedCount: 0, status: "processing" });
    }

    const itemsHtml = restockedVariants
      .map((variant) => {
        const details = inventoryToVariantDetails.get(variant.inventory_item_id);
        if (!details) return "";
        return `
      <div class="product-card">
        <div class="product-content" style="display: flex; gap: 10px;">
          <div class="product-image">
            <img src="${details.image || ""}" 
                 alt="${details.title}" 
                 style="width:100%;border-radius:4px;height:100%;"/>
          </div>
          <div class="product-details">
            <h3 class="product-name">${details.title}</h3>
            <p class="product-price">${details.price}</p>
            <p><strong>Now Available:</strong> ${variant.tracked === false || details.tracked === false ? "In Stock" : variant.available}</p>
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
          const messageId = responseData?.result?.id || responseData?.result?.messageId || null;
          console.log(`✅ Restock notification sent to ${email}, MessageID: ${messageId}`);
          successfullyNotifiedEmails.push(email);
          await updateUserEmailFlag(user, shop, {
            emailStatus: "sent",
            messageId,
            emailSent: 1
          });
        } else {
          const errorMessage = responseData?.error || responseData?.message || response.statusText;
          console.error(`❌ Failed to send to ${email}:`, errorMessage);
          await updateUserEmailFlag(user, shop, {
            emailStatus: "failed"
          });
        }
      } catch (emailError) {
        console.error(`❌ Exception sending to ${email}:`, emailError.message);
        await updateUserEmailFlag(user, shop, {
          emailStatus: "failed"
        });
      }

      if (isManual) {
        const prog = manualSendProgress.get(shop);
        if (prog) {
          manualSendProgress.set(shop, { 
            ...prog, 
            current: i + 1,
            failedCount: (prog.failedCount || 0) + (successfullyNotifiedEmails.includes(email) ? 0 : 1)
          });
        }
      }

      // 500ms delay between every single email. This ensures the SMTP server 
      // doesn't see multiple logins at the same time and blocks the account.
      if (i < recipientEmails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (isManual) {
      const prog = manualSendProgress.get(shop);
      if (prog) {
        manualSendProgress.set(shop, { ...prog, status: "completed" });
        // Clear progress after 1 minute to keep memory clean
        setTimeout(() => manualSendProgress.delete(shop), 60000);
      }
    }

    return { 
      sentCount: successfullyNotifiedEmails.length, 
      error: successfullyNotifiedEmails.length === 0 && matchingUsers.length > 0 ? "Server error: No emails were sent." : null 
    };
  } catch (error) {
    console.error("Error sending restock notification:", error);
    if (isManual) {
      manualSendProgress.set(shop, { status: "failed", error: error.message });
      // Clear progress after 1 minute to keep memory clean
      setTimeout(() => manualSendProgress.delete(shop), 60000);
    }
    return { sentCount: 0, error: error.message };
  }
}

export async function updateUserEmailFlag(user, shopDomain, updateFields = { emailSent: 1, emailStatus: "sent" }) {
  console.log(`🔄 Updating email status for user ${user.email} in shop ${shopDomain}:`, updateFields);
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
        ...updateFields,
      }),
    });

    if (response.ok) {
      console.log(`✅ Updated emailSent flag for user ${user.email}`);
    } else {
      console.error(`❌ Failed to update emailSent flag for user ${user.email}`);
    }
  } catch (error) {
    console.error(`❌ Error updating emailSent flag for user ${user.email}:`, error);
  }
}

export async function fetchVariantDetailsFromInventoryId(inventoryItemId, shopDomainName, token) {
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
                  inventoryItem {
                    tracked
                  }
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

    const placeholderImage = "https://via.placeholder.com/300?text=No+Image+Available";

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
      tracked: variant.inventoryItem?.tracked
    };
  } catch (error) {
    console.error("GraphQL fetchVariantDetails error:", error);
    return null;
  }
}

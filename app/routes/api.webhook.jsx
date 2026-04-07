import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { sendRestockNotification, manualSendProgress } from "../utils/notification";
import User from "../modes/users";

export async function loader({ request }) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const shop = url.searchParams.get("shopDomain") || url.searchParams.get("shop");

  if (action === "progress" && shop) {
    const progress = manualSendProgress.get(shop) || { total: 0, current: 0, status: "idle" };
    return json(progress);
  }

  return json({ message: "Webhook endpoint ready" });
}

export async function action({ request }) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const actionParam = url.searchParams.get("action");

    // 1. Handle Manual Send from Dashboard
    if (actionParam === "manual") {
      const { session, admin } = await authenticate.admin(request);
      const manualShop = session.shop;

      // Fetch pending or failed users directly from DB
      const usersArray = await User.find({ shopDomain: manualShop }).lean();
      const pendingUsers = (usersArray || []).filter(user => 
        (user.emailStatus === "pending" || user.emailStatus === "failed") ||
        (!user.emailStatus && (user.emailSent || 0) === 0)
      );

      if (pendingUsers.length === 0) {
        return json({ success: true, message: "No pending subscribers found." });
      }

      // Identify unique variants and check stock
      const uniqueVariantIds = [...new Set(pendingUsers.map(u => u.variantId))];
      const variantStockList = [];

      for (const variantId of uniqueVariantIds) {
        const gid = variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`;
        const response = await admin.graphql(`
          query($id: ID!) {
            productVariant(id: $id) {
              inventoryQuantity
              inventoryItem {
                id
                tracked
              }
            }
          }`, { variables: { id: gid } }
        );

        const result = await response.json();
        const variantData = result?.data?.productVariant;
        if (variantData) {
          const inventoryItemId = variantData.inventoryItem?.id.split('/').pop();
          const available = variantData.inventoryQuantity || 0;
          const tracked = variantData.inventoryItem?.tracked;
          if (inventoryItemId) {
            variantStockList.push({ inventory_item_id: inventoryItemId, available, tracked });
          }
        }
      }

      const inStockVariants = variantStockList.filter(v => v.tracked === false || v.available > 0);
      if (inStockVariants.length === 0) {
        return json({ success: true, message: "None of the requested products are currently in stock." });
      }

      // Fire and forget the notification process in the background
      sendRestockNotification(inStockVariants, manualShop, session.accessToken, { isManual: true })
        .then(result => console.log("Background manual send complete:", result))
        .catch(err => console.error("Background manual send error:", err));
      
      return json({ 
        success: true, 
        message: "Notification process started in the background. It may take a few minutes to complete.",
        sentCount: 0 
      });
    }

    // 2. Handle Auto-Send from Shopify Webhook
    if (!shop) return json({ message: "Inventory update received" }, { status: 200 });

    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      throw new Error(`No session found for shop: ${shop}`);
    }

    const data = await request.json();
    const updates = Array.isArray(data) ? data : [data];
    const restockedVariants = updates.filter(item => item.available > 0);

    if (restockedVariants.length > 0) {
      await sendRestockNotification(restockedVariants, session.shop, session.accessToken);
    }

    return json({ message: "Inventory update processed", receivedData: data, shop }, { status: 200 });

  } catch (error) {
    console.error("Error in webhook/manual action:", error);
    return json({ message: "Error processing request", error: error.message }, { status: 500 });
  }
}

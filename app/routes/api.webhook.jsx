import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendRestockNotification } from "../utils/notification";

export const loader = async () => {
  return json({ message: "Inventory webhook endpoint" });
};

export async function action({ request }) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const actionParam = url.searchParams.get("action");

    // 1. Handle Manual Send from Dashboard
    if (actionParam === "manual") {
      const { session, admin } = await authenticate.admin(request);
      const manualShop = session.shop;

      // Fetch pending or failed users
      const usersApi = `${process.env.SHOPIFY_APP_URL}/api/users?shopDomain=${manualShop}`;
      const usersResponse = await fetch(usersApi);
      if (!usersResponse.ok) {
        throw new Error(`Failed to fetch users: ${usersResponse.status}`);
      }
      const usersJson = await usersResponse.json();
      const pendingUsers = (usersJson.users || []).filter(user => 
        (!user.emailStatus || user.emailStatus === "pending" || user.emailStatus === "failed") && 
        (user.emailSent || 0) === 0
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
              }
            }
          }`, { variables: { id: gid } }
        );

        const result = await response.json();
        const variantData = result?.data?.productVariant;
        if (variantData) {
          const inventoryItemId = variantData.inventoryItem?.id.split('/').pop();
          const available = variantData.inventoryQuantity || 0;
          if (inventoryItemId) {
            variantStockList.push({ inventory_item_id: inventoryItemId, available });
          }
        }
      }

      const inStockVariants = variantStockList.filter(v => v.available > 0);
      if (inStockVariants.length === 0) {
        return json({ success: true, message: "None of the requested products are currently in stock." });
      }

      const results = await sendRestockNotification(inStockVariants, manualShop, session.accessToken, { isManual: true });
      return json({ 
        success: true, 
        message: `Manual send complete. ${results.length} emails sent.`,
        sentCount: results.length
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

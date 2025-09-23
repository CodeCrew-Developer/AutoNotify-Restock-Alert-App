// app/routes/api.manage-webhooks.jsx
import { authenticate } from "../shopify.server";
import {
  GET_WEBHOOKS_QUERY,
  CREATE_WEBHOOK_QUERY,
  DELETE_WEBHOOK_QUERY,
} from "../constant/graphqlQueries";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { session, admin } = await authenticate.admin(request);
    const body = await request.json();
    const { action: requestAction, appUrl } = body;

    // Get existing webhooks
    const getWebhooks = await admin.graphql(GET_WEBHOOKS_QUERY, {
      variables: { topic: ["INVENTORY_LEVELS_UPDATE"] },
    });

    const resp = await getWebhooks.json();
    const existingWebhooks = resp.data.webhookSubscriptions.edges;
    // console.log(existingWebhooks, "requestAction");
    if (requestAction === "create") {
     
      existingWebhooks.forEach(async (item) => {
        const webhookDetail = item.node;
       
        const data = await admin.graphql(DELETE_WEBHOOK_QUERY, {
          variables: {
            id: webhookDetail.id,
          },
        });
        const datata = await data.json();
        // console.log(datata.data, "datata");
        
      });
    

      
        const webhook = await admin.graphql(CREATE_WEBHOOK_QUERY, {
          variables: {
            topic: "INVENTORY_LEVELS_UPDATE",
            webhookSubscription: {
              callbackUrl: `${appUrl}/api/webhook?shop=${session.shop}`,
            },
          },
        });

        const createResult = await webhook.json();

        if (createResult.data.webhookSubscriptionCreate.webhookSubscription) {
      return Response.json({
        success: true,
        message: "Webhook created successfully",
        webhook:
          "createResult.data.webhookSubscriptionCreate.webhookSubscription",
      });
        } else {
          return Response.json({
            success: false,
            message: "Failed to create webhook",
            errors: createResult.data.webhookSubscriptionCreate.userErrors,
          });
        }
    } else if (requestAction === "delete") {
     
      let deletedCount = 0;

      for (const edge of existingWebhooks) {
        const webhookDetail = edge.node;
        if (webhookDetail.callbackUrl.includes(appUrl)) {
          const deleteWebhook = await admin.graphql(DELETE_WEBHOOK_QUERY, {
            variables: {
              id: webhookDetail.id,
            },
          });

          const deleteResult = await deleteWebhook.json();
          if (
            deleteResult.data.webhookSubscriptionDelete
              .deletedWebhookSubscriptionId
          ) {
            deletedCount++;
          }
        }
      }

      return Response.json({
        success: true,
        message: `${deletedCount} webhook(s) deleted successfully`,
        deletedCount,
      });
    } else {
      return Response.json(
        {
          success: false,
          message: "Invalid action",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error managing webhooks:", error);
    return Response.json(
      {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 },
    );
  }
};

// app/routes/api.manage-webhooks.jsx
import { cors } from "remix-utils/cors";
import { authenticate } from "../shopify.server";
import {
  GET_WEBHOOKS_QUERY,
  CREATE_WEBHOOK_QUERY,
  DELETE_WEBHOOK_QUERY,
} from "../constant/graphqlQueries";

export const loader = async ({ request }) => {
  const response = new Response("Method not allowed", { status: 405 });
  return await cors(request, response);
};

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    const response = new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405 },
    );
    return await cors(request, response);
  }

  try {
    const { session, admin } = await authenticate.admin(request);

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "Invalid JSON in request body",
        }),
        { status: 400 },
      );
      return await cors(request, response);
    }

    const { action: requestAction, appUrl } = body;

    // Validate required fields
    if (!requestAction) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "Missing required field: action",
        }),
        { status: 400 },
      );
      return await cors(request, response);
    }

    if (requestAction === "create" && !appUrl) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "Missing required field: appUrl for create action",
        }),
        { status: 400 },
      );
      return await cors(request, response);
    }

    // Get existing webhooks
    const getWebhooks = await admin.graphql(GET_WEBHOOKS_QUERY, {
      variables: { topic: ["INVENTORY_LEVELS_UPDATE"] },
    });

    const resp = await getWebhooks.json();

    // Check for GraphQL errors
    if (resp.errors) {
      console.error("GraphQL errors while fetching webhooks:", resp.errors);
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch existing webhooks",
          errors: resp.errors,
        }),
        { status: 500 },
      );
      return await cors(request, response);
    }

    const existingWebhooks = resp.data?.webhookSubscriptions?.edges || [];

    if (requestAction === "create") {
      // Delete existing webhooks first (fixed async/await issue)
      const deletionPromises = existingWebhooks.map(async (item) => {
        try {
          const webhookDetail = item.node;
          const deleteResponse = await admin.graphql(DELETE_WEBHOOK_QUERY, {
            variables: {
              id: webhookDetail.id,
            },
          });
          const deleteResult = await deleteResponse.json();

          if (deleteResult.errors) {
            console.error(
              `Error deleting webhook ${webhookDetail.id}:`,
              deleteResult.errors,
            );
          }

          return deleteResult;
        } catch (error) {
          console.error(`Failed to delete webhook:`, error);
          return null;
        }
      });

      // Wait for all deletions to complete
      await Promise.all(deletionPromises);

      // Create new webhook
      try {
        const webhook = await admin.graphql(CREATE_WEBHOOK_QUERY, {
          variables: {
            topic: "INVENTORY_LEVELS_UPDATE",
            webhookSubscription: {
              callbackUrl: `${appUrl}/api/webhook?shop=${session.shop}`,
            },
          },
        });

        const createResult = await webhook.json();

        if (createResult.errors) {
          console.error(
            "GraphQL errors while creating webhook:",
            createResult.errors,
          );
          const response = new Response(
            JSON.stringify({
              success: false,
              message: "Failed to create webhook due to GraphQL errors",
              errors: createResult.errors,
            }),
            { status: 500 },
          );
          return await cors(request, response);
        }

        if (createResult.data?.webhookSubscriptionCreate?.webhookSubscription) {
          const response = new Response(
            JSON.stringify({
              success: true,
              message: "Webhook created successfully",
              webhook:
                createResult.data.webhookSubscriptionCreate.webhookSubscription,
            }),
            { status: 200 },
          );
          return await cors(request, response);
        } else {
          const response = new Response(
            JSON.stringify({
              success: false,
              message: "Failed to create webhook",
              errors:
                createResult.data?.webhookSubscriptionCreate?.userErrors || [],
            }),
            { status: 400 },
          );
          return await cors(request, response);
        }
      } catch (createError) {
        console.error("Error creating webhook:", createError);
        const response = new Response(
          JSON.stringify({
            success: false,
            message: "Failed to create webhook",
            error: createError.message,
          }),
          { status: 500 },
        );
        return await cors(request, response);
      }
    } else if (requestAction === "delete") {
      let deletedCount = 0;
      const errors = [];

      // Process deletions sequentially to avoid rate limits
      for (const edge of existingWebhooks) {
        try {
          const webhookDetail = edge.node;

          // If appUrl is provided, only delete webhooks matching that URL
          if (appUrl && !webhookDetail.callbackUrl.includes(appUrl)) {
            continue;
          }

          const deleteWebhook = await admin.graphql(DELETE_WEBHOOK_QUERY, {
            variables: {
              id: webhookDetail.id,
            },
          });

          const deleteResult = await deleteWebhook.json();

          if (deleteResult.errors) {
            console.error(
              `Error deleting webhook ${webhookDetail.id}:`,
              deleteResult.errors,
            );
            errors.push(...deleteResult.errors);
          } else if (
            deleteResult.data?.webhookSubscriptionDelete
              ?.deletedWebhookSubscriptionId
          ) {
            deletedCount++;
          }
        } catch (deleteError) {
          console.error(`Failed to delete webhook:`, deleteError);
          errors.push({ message: deleteError.message });
        }
      }

      const response = new Response(
        JSON.stringify({
          success: true,
          message: `${deletedCount} webhook(s) deleted successfully`,
          deletedCount,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { status: 200 },
      );
      return await cors(request, response);
    } else {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "Invalid action. Supported actions: create, delete",
        }),
        { status: 400 },
      );
      return await cors(request, response);
    }
  } catch (error) {
    console.error("Error managing webhooks:", error);
    const response = new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      { status: 500 },
    );
    return await cors(request, response);
  }
};

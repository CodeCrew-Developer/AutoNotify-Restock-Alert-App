export const DELETE_WEBHOOK_QUERY = `mutation webhookDelete($id:ID!) {
        webhookSubscriptionDelete(id: $id) {
          deletedWebhookSubscriptionId
              userErrors {
                field
                message
              }
        }
      }`;

export const GET_WEBHOOKS_QUERY = `query GetWebhooks($topics: [WebhookSubscriptionTopic!]) {
  webhookSubscriptions(first: 10, topics: $topics) {
    edges {
      node {
        id
        topic
        callbackUrl
      }
    }
  }
}`;

export const CREATE_WEBHOOK_QUERY = `mutation webhookSubscriptionCreate(
       $topic: WebhookSubscriptionTopic!,
       $webhookSubscription: WebhookSubscriptionInput!
     ) {
       webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
         webhookSubscription {
           id
           topic
           endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } }
         }
         userErrors { field message }
       }
     }`;

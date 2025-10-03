import { useEffect, useState } from "react";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  Badge,
  InlineStack,
  Banner,
  Grid,
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate, apiVersion } from "../shopify.server";
import { json } from "@remix-run/node";
import auto_NotifyLogo from "../uploads/Auto_notify_logo.png";

export const loader = async ({ request }) => {
  const appUrl = process.env.SHOPIFY_APP_URL;
  const { admin, session } = await authenticate.admin(request);
  
  try {
    const { shop, accessToken } = session;
    const appId = process.env.SHOPIFY_NOTIFY_ME_ID;
    // console.log("appIdappIdappId",appId)

    // Get shop details
    const responseOfShop = await fetch(
      `https://${shop}/admin/api/${apiVersion}/shop.json`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      },
    );

    if (!responseOfShop.ok) {
      throw new Error(
        `Failed to fetch shop details: ${responseOfShop.status} ${responseOfShop.statusText}`,
      );
    }

    const shopDetails = await responseOfShop.json();

    // Get shop ID
    const shopQuery = await admin.graphql(`
      query {
        shop {
          id
        }
      }
    `);
    const shopData = await shopQuery.json();
    const shopId = shopData.data.shop.id;

    // Save appUrl metafield
    await admin.graphql(`
      mutation SaveAppUrl {
        metafieldsSet(metafields: [
          {
            namespace: "custom"
            key: "app_url"
            type: "single_line_text_field"
            value: "${appUrl}"
            ownerId: "${shopId}"
          }
        ]) {
          metafields { id key value }
          userErrors { field message }
        }
      }
    `);

    // Get themes
    const themeResponse = await admin.graphql(`
      query {
        themes(first: 20) {
          edges {
            node {
              id
              name
              role
            }
          }
        }
      }
    `);
    const themeJson = await themeResponse.json();
    const themeNames = themeJson.data.themes.edges;
    const activeTheme = themeNames.find((t) => t.node.role === "MAIN")?.node;

    // Save access token and block ID metafields
    await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [
          {
            ownerId: "${shopId}",
            namespace: "accesstoken",
            key: "token",
            value: "${accessToken}",
            type: "string"
          },
          {
            ownerId: "${shopId}",
            namespace: "blockID",
            key: "blockID",
            value: "${appId}",
            type: "string"
          }
        ]) {
          metafields { id }
        }
      }
    `);

    // Check app embed status
    let isAppEmbedded = false;
    
    let appEmbedDetails = null;

    if (activeTheme?.id && appId) {
      try {
        const numericThemeId = activeTheme.id.split("/").pop();

        const appEmbedsResponse = await fetch(
          `https://${shop}/admin/api/${apiVersion}/themes/${numericThemeId}/assets.json?asset[key]=config/settings_data.json`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
          },
        );

       if (appEmbedsResponse.ok) {
  const appEmbedsData = await appEmbedsResponse.json();
  const settingsData = JSON.parse(appEmbedsData.asset.value);
  const currentBlocks = settingsData.current?.blocks || {};
  // console.log("currentBlocks", currentBlocks);

  // Extract handle from appId if needed, or set it manually
  const appHandle = "autonotify-restock-alert"; // from your block.type

  const appBlockEntry = Object.entries(currentBlocks).find(
    ([, block]) => block.type?.includes(appHandle)
  );

  if (appBlockEntry) {
    const [blockId, appBlock] = appBlockEntry;

    isAppEmbedded = !appBlock.disabled;
    // console.log("isAppEmbedded", isAppEmbedded);

    appEmbedDetails = {
      blockId,
      blockType: appBlock.type,
      settings: appBlock.settings || {},
      disabled: appBlock.disabled || false,
    };
    // console.log("appEmbedDetails", appEmbedDetails);
  } else {
    console.log("No matching app block found for appHandle:", appHandle);
  }
}

      } catch (embedError) {
        console.error("Error checking app embed:", embedError);
      }
    }

    return json({
      shopDetails,
      appUrl,
      session,
      appId,
      blockType: "restock-alert",
      themeNames,
      activeTheme,
      isAppEmbedded,
      appEmbedDetails,
    });
  } catch (error) {
    console.error("Loader error", error);
    return json({
      shopDetails: null,
      appUrl: process.env.SHOPIFY_APP_URL,
      session: null,
      appId: process.env.SHOPIFY_NOTIFY_ME_ID,
      blockType: "restock-alert",
      themeNames: [],
      activeTheme: null,
      isAppEmbedded: false,
      appEmbedDetails: null,
    });
  }
};

export default function NotifyDashboard() {
  const data = useLoaderData();

  // States
  const [shopOwnerName, setShopOwnerName] = useState("User");
  const [showBanner, setShowBanner] = useState(true);

  const { activeTheme, session, appId, blockType, isAppEmbedded } = data;
  const storeDomain = session?.shop?.split(".")[0];
  const themeId = activeTheme?.id?.split("/").pop();

  const appData = [
    {
      title: "QBoost: Upsell & Cross Sell",
      description:
        "Maximize your store's potential with seamless upsell features that drive extra revenue.",
      imageUrl:
        "https://cdn.shopify.com/s/files/1/0560/1535/6003/files/QuickBoostLogo.png?v=1742299521",
      imageAlt: "QBoost",
      appUrl: "https://apps.shopify.com/qboost-upsell-cross-sell",
    },
    {
      title: "Stock Locator",
      description:
        "Stock Locator is a powerful inventory tracking app It provides real-time visibility of product stock.",
      imageUrl:
        "https://cdn.shopify.com/s/files/1/0560/1535/6003/files/stock_locator.jpg?v=1757494715",
      imageAlt: "Stock Locator",
      appUrl: "https://apps.shopify.com/stock-locator",
    },
    {
      title: "Trust Me",
      description:
        "Trust Me helps you collect, manage, and display authentic customer reviews on your store.",
      imageUrl:
        "https://cdn.shopify.com/s/files/1/0560/1535/6003/files/trust_me.png?v=1757495776",
      imageAlt: "Trust Me",
      appUrl: "https://apps.shopify.com/trust-me",
    },
    {
      title: "ScriptInjector",
      description:
        "Effortlessly insert custom scripts into your store for enhanced tracking and functionality.",
      imageUrl:
        "https://cdn.shopify.com/s/files/1/0560/1535/6003/files/ScriptInjectorLogo.png?v=1742298347",
      imageAlt: "Script Injector",
      appUrl: "https://apps.shopify.com/scriptinjectorapp",
    },
  ];

  useEffect(() => {
    const shop = data?.shopDetails?.shop?.shop_owner;
    setShopOwnerName(shop);
  }, [data]);

  const greetings = () => {
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) {
      return "Morning";
    } else if (currentHour >= 12 && currentHour < 18) {
      return "Afternoon";
    } else {
      return "Evening";
    }
  };

  return (
    <Page title="Dashboard">
      <TitleBar title="Stock Inventory Dashboard"></TitleBar>

      <Layout>
        {showBanner && (
          <Layout.Section>
            {isAppEmbedded && activeTheme ? (
              <Banner
                title="App Embed Status"
                tone="success"
                onDismiss={() => setShowBanner(false)}
              >
                <InlineStack
                  gap="200"
                  align="space-between"
                  blockAlign="center"
                >
                  <InlineStack
                    gap="200"
                    align="space-between"
                    blockAlign="center"
                  >
                    <Box as="span">Live Theme:</Box>
                    <Text fontWeight="bold">
                      {activeTheme?.name || "Dawn"}
                    </Text>
                    <Badge tone="success">Active</Badge>
                  </InlineStack>
                  <Button
                    variant="secondary"
                    url={`https://admin.shopify.com/store/${storeDomain}/themes/${themeId}/editor?context=apps&activateAppId=${appId}/${blockType}`}
                    target="_blank"
                  >
                    Disable
                  </Button>
                </InlineStack>
              </Banner>
            ) : (
              <Banner
                tone="warning"
                title="Enable App Embed"
                onDismiss={() => setShowBanner(false)}
              >
                <InlineStack gap="200" align="space-between">
                  <Text>
                    Enable App Embeds to use the app featured in your store.
                  </Text>
                  <Button
                    variant="primary"
                    url={`https://admin.shopify.com/store/${storeDomain}/themes/${themeId}/editor?context=apps&activateAppId=${appId}/${blockType}`}
                    target="_blank"
                  >
                    Enable
                  </Button>
                </InlineStack>
              </Banner>
            )}
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Box
              style={{
                display: "flex",
                flexGrow: 1,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Box style={{ display: "flex" }}>
                  <Text as="h1" variant="headingXl">
                    Good {greetings()},&nbsp;
                  </Text>

                  <Text as="h1" variant="headingXl">
                    {shopOwnerName ? shopOwnerName : "User"} 👋
                  </Text>
                </Box>
                <Box paddingBlockStart="100">
                  <Text as="p" variant="bodyLg">
                    Welcome to AutoNotify - Restock Alert App
                  </Text>
                </Box>
              </Box>
              <Thumbnail
                source={auto_NotifyLogo}
                size="large"
                alt="AutoNotify Logo"
                transparent
              />
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card
            style={{
              backgroundColor: "#F6F6F7",
              padding: "16px",
              borderRadius: "8px",
            }}
          >
            <Box padding="400" background="bg-surface-secondary">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3" fontWeight="bold">
                  Add app block on product page
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Add the restock alert button to your product pages to
                  allow customers to subscribe to notifications.
                </Text>

                <Box paddingBlockStart="200">
                  <Button
                    variant="primary"
                    url={
                      themeId && session && appId
                        ? `https://admin.shopify.com/store/${storeDomain}/themes/${themeId}/editor?template=product&addAppBlockId=${appId}/star_rating&target=mainSection`
                        : "#"
                    }
                    target="_blank"
                    external="true" 
                  >
                    Add app block
                  </Button>
                </Box>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Box paddingBlockEnd="500">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    Recommended apps
                  </Text>
                  <Button
                    url="https://apps.shopify.com/partners/gaurang2"
                    external="true"
                    target="_blank"
                  >
                    More Apps
                  </Button>
                </InlineStack>

                <Grid>
                  {appData.map((app, index) => (
                    <Grid.Cell
                      key={index}
                      columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}
                    >
                      <Card title="Sales" sectioned>
                        <InlineStack wrap={false} gap="400">
                          <Box>
                            <img
                              src={app.imageUrl}
                              alt={app.imageAlt}
                              style={{
                                width: "5rem",
                                height: "5rem",
                                borderRadius: "10px",
                              }}
                            />
                          </Box>
                          <BlockStack inlineAlign="start" gap="100">
                            <Text variant="headingMd" as="h2">
                              <div>{app.title}</div>
                            </Text>
                            <Text variant="bodyMd" as="p">
                              <div style={{ marginBottom: "5px" }}>
                                {app.description}
                              </div>
                            </Text>
                            <Button
                              url={app.appUrl}
                              external="true"
                              target="_blank"
                              fullWidth={false}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                Install Now
                              </div>
                            </Button>
                          </BlockStack>
                        </InlineStack>
                      </Card>
                    </Grid.Cell>
                  ))}
                </Grid>
              </BlockStack>
            </Card>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

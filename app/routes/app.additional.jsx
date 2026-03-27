import { useLoaderData } from "@remix-run/react";
import { TitleBar } from "@shopify/app-bridge-react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  DataTable,
  Divider,
  EmptyState,
  FooterHelp,
  Frame,
  Grid,
  Icon,
  InlineStack,
  Layout,
  Link,
  Page,
  Pagination,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonThumbnail,
  Tabs,
  Text,
  TextField,
  Toast,
  Tooltip,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  EmailIcon,
  PersonSegmentIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  StatusActiveIcon,
} from "@shopify/polaris-icons";
import React from "react";
import CreateTemplateModal from "../componentsModal/CreateTemplate";
import { GET_WEBHOOKS_QUERY } from "../constant/graphqlQueries";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const API_ENDPOINT = process.env.SHOPIFY_APP_URL + "/api/users";
  // console.log("API_ENDPOINT",API_ENDPOINT)
  const appUrl = process.env.SHOPIFY_APP_URL;

  const { session, admin } = await authenticate.admin(request);
  let users = [];
  let webhookExists = false;
  let shopDetail = {};
  let shopSettings = null;

  try {
    const shopGraphql = await admin.graphql(`
      {
        shop {
          name
          email
          myshopifyDomain
        }
      }
    `);
    shopDetail = (await shopGraphql.json()).data.shop;

    const usersResponse = await fetch(
      `${API_ENDPOINT}?shopDomain=${shopDetail.myshopifyDomain}`,
    );
    if (usersResponse.ok) {
      const usersData = await usersResponse.json();

      users = usersData.users || [];
      // console.log("usersusersusers",users)

      shopSettings = usersData.shopSettings;
    }

    const getWebhooks = await admin.graphql(GET_WEBHOOKS_QUERY, {
      variables: { topic: ["INVENTORY_LEVELS_UPDATE"] },
    });

    const resp = await getWebhooks.json();
    if (resp.data.webhookSubscriptions.edges.length) {
      const webhookDetail = resp.data.webhookSubscriptions.edges[0].node;
      if (webhookDetail.callbackUrl.includes(appUrl)) {
        webhookExists = true;
      }
    }

    if (shopSettings) {
      webhookExists = shopSettings.autoEmailGloballyEnabled;
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  return {
    users,
    webhookExists,
    session,
    email: shopDetail.email,
    shopDomain: shopDetail.myshopifyDomain,
    appUrl,
    shopSettings,
  };
};

export default function EnhancedUsersPage() {
  const data = useLoaderData();
  const { session, appUrl } = useLoaderData();
  const [users, setUsers] = React.useState(data.users || []);
  const [webhookExists, setWebhookExists] = React.useState(
    data.webhookExists || false,
  );
  const [showTemplateEditor, setShowTemplateEditor] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [filteredUsers, setFilteredUsers] = React.useState(users);
  const [toastActive, setToastActive] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState("");
  const [toastError, setToastError] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  // ── ADDED: separate loading state for the Refresh button ──
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage] = React.useState(10);
  const [sortColumn, setSortColumn] = React.useState(3);
  const [sortDirection, setSortDirection] = React.useState("descending");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    setFilteredUsers(users);
  }, [users]);

  const handleSearchChange = React.useCallback(
    (value) => {
      setSearchValue(value);
      const filtered = users.filter(
        (user) =>
          user.email?.toLowerCase().includes(value.toLowerCase()) ||
          user.productId?.toLowerCase().includes(value.toLowerCase()) ||
          user.variantId?.toLowerCase().includes(value.toLowerCase()),
      );
      setFilteredUsers(filtered);
      setCurrentPage(1);
    },
    [users],
  );

  // ── ADDED: fetches latest users from API without a full page reload ──
  const refreshData = React.useCallback(
    async (showToast = false) => {
      setIsRefreshing(true);
      try {
        const response = await fetch(
          `/api/users?shopDomain=${data.shopDomain}`,
        );

        if (!response.ok) throw new Error("Failed to fetch users");

        const result = await response.json();
        const freshUsers = result.users || [];

        setUsers(freshUsers);

        // Re-apply active search filter against the fresh data
        if (searchValue) {
          const filtered = freshUsers.filter(
            (user) =>
              user.email?.toLowerCase().includes(searchValue.toLowerCase()) ||
              user.productId
                ?.toLowerCase()
                .includes(searchValue.toLowerCase()) ||
              user.variantId
                ?.toLowerCase()
                .includes(searchValue.toLowerCase()),
          );
          setFilteredUsers(filtered);
        } else {
          setFilteredUsers(freshUsers);
        }

        setCurrentPage(1);

        if (showToast) {
          setToastMessage(
            `Data Refreshed Successfully`,
          );
          setToastError(false);
          setToastActive(true);
        }
      } catch (error) {
        console.error("Error refreshing data:", error);
        setToastMessage("Failed to refresh data. Please try again.");
        setToastError(true);
        setToastActive(true);
      } finally {
        setIsRefreshing(false);
      }
    },
    [data.shopDomain, searchValue],
  );
  // ────────────────────────────────────────────────────────────────────

  const updateShopSettings = async (autoEmailEnabled, webhookActive) => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateShopSettings",
          shopDomain: data.shopDomain,
          autoEmailGloballyEnabled: autoEmailEnabled,
          webhookActive: webhookActive,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update shop settings");
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Error updating shop settings:", error);
      return false;
    }
  };

  const handleToggleWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/manage-webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: webhookExists ? "delete" : "create",
          session: session,
          appUrl: data.appUrl,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.success) {
          const newWebhookState = !webhookExists;

          setWebhookExists(newWebhookState);

          const settingsUpdated = await updateShopSettings(
            newWebhookState,
            newWebhookState,
          );

          if (settingsUpdated) {
            setToastMessage(
              webhookExists
                ? "Auto-Email Notifications Disabled"
                : "Auto-Email Notifications Enabled",
            );
          } else {
            setToastMessage(
              webhookExists
                ? "Auto-Email Notifications Disabled"
                : "Auto-Email Notifications Enabled",
            );
          }
        } else {
          throw new Error(result.message || "Failed to manage webhooks");
        }

        setToastActive(true);
      } else {
        throw new Error("Failed to manage webhooks");
      }
    } catch (error) {
      console.error("Error managing webhooks:", error);
      setToastMessage("Error managing auto-email settings");
      setToastActive(true);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredUsersByTab = () => {
    let baseUsers = searchValue ? filteredUsers : users;

    switch (selectedTab) {
      case 0:
        return baseUsers;
      case 1:
        return baseUsers.filter((user) =>
          user.emailStatus === "sent" ||
          (user.emailSent || 0) > 0
        );
      case 2:
        return baseUsers.filter((user) =>
          user.emailStatus !== "sent" && user.emailStatus !== "failed" && (user.emailSent || 0) === 0
        );
      case 3:
        return baseUsers.filter((user) => user.emailStatus === "failed");
      default:
        return baseUsers;
    }
  };

  const getSortedUsers = (usersToSort) => {
    if (!sortColumn && sortColumn !== 0) return usersToSort;

    return [...usersToSort].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 0: // Subscriber Details (email)
          aValue = (a.email || "").toLowerCase();
          bValue = (b.email || "").toLowerCase();
          break;
        case 1: // Product Information (variantId)
          aValue = (a.variantId || "").toLowerCase();
          bValue = (b.variantId || "").toLowerCase();
          break;
        case 2: // Email Status
          aValue = a.emailStatus === "failed" ? 3 : (a.emailStatus === "sent" || (a.emailSent || 0) > 0) ? 2 : 1;
          bValue = b.emailStatus === "failed" ? 3 : (b.emailStatus === "sent" || (b.emailSent || 0) > 0) ? 2 : 1;
          break;
        case 3: // Timeline (createdAt)
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "ascending" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "ascending" ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (index) => {
    if (sortColumn === index) {
      setSortDirection(
        sortDirection === "ascending" ? "descending" : "ascending",
      );
    } else {
      setSortColumn(index);
      setSortDirection("ascending");
    }
    setCurrentPage(1);
  };

  const getCurrentPageUsers = () => {
    const tabFilteredUsers = getFilteredUsersByTab();
    const sortedUsers = getSortedUsers(tabFilteredUsers);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedUsers.slice(startIndex, endIndex);
  };

  const tabFilteredUsers = getFilteredUsersByTab();
  const totalPages = Math.ceil(tabFilteredUsers.length / itemsPerPage);
  const currentUsers = getCurrentPageUsers();

  const totalEmailsSent = filteredUsers.reduce(
    (total, user) => {
      if ((user.emailSent || 0) > 0) return total + user.emailSent;
      if (user.emailStatus === "sent") return total + 1;
      return total;
    },
    0,
  );
  const usersWithEmailsSent = filteredUsers.filter(
    (user) => user.emailStatus === "sent" || user.emailSent > 0,
  ).length;
  const pendingUsers = filteredUsers.filter(
    (user) => user.emailStatus !== "sent" && user.emailStatus !== "failed" && (user.emailSent || 0) === 0,
  ).length;

  // ── DETECTION LOGIC: If any recently sent email failed due to logic/SMTP ──
  const failedEmails = filteredUsers.filter((u) => u.emailStatus === "failed");
  const failedUsersCount = failedEmails.length;

  const baseNotified = users.filter((u) => u.emailStatus === "sent" || (u.emailSent || 0) > 0).length;
  const basePending = users.filter((u) => u.emailStatus !== "sent" && u.emailStatus !== "failed" && (u.emailSent || 0) === 0).length;
  const baseFailed = users.filter((u) => u.emailStatus === "failed").length;

  const tabs = React.useMemo(() => [
    {
      id: "all-users",
      content: `All Users (${users.length})`,
      accessibilityLabel: "All users",
      panelID: "all-users-content",
    },
    {
      id: "notified-users",
      content: `Notified (${baseNotified})`,
      accessibilityLabel: "Notified users",
      panelID: "notified-users-content",
    },
    {
      id: "pending-users",
      content: `Pending (${basePending})`,
      accessibilityLabel: "Pending users",
      panelID: "pending-users-content",
    },
    {
      id: "failed-users",
      content: `Failed (${baseFailed})`,
      accessibilityLabel: "Failed users",
      panelID: "failed-users-content",
    },
  ], [users.length, baseNotified, basePending, baseFailed]);

  const handleTabChange = (selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
    setCurrentPage(1);
  };

  const userRows = currentUsers.map((user, index) => {
    const emailSentCount = user.emailSent || 0;

    return [
      <BlockStack gap="100">
        <Text as="p" variant="bodyMd" fontWeight="medium">
          {user.email || "No email"}
        </Text>
      </BlockStack>,
      <BlockStack gap="100" key={`product-${index}`}>
        {user.productTitle && (
          <Text as="p" variant="bodyMd" fontWeight="medium">
            Product: {user.productTitle || "null"}
          </Text>
        )}
        <Text as="p" variant="bodySm" fontWeight="medium">
          Variant ID: {user.variantId || "No variant ID"}
        </Text>
      </BlockStack>,
      <InlineStack gap="100">
        <Badge
          tone={
            user.emailStatus === "sent" ? "success" :
              user.emailStatus === "failed" ? "critical" :
                (user.emailSent > 0 ? "success" : "attention")
          }
          size="small"
        >
          {user.emailStatus
            ? user.emailStatus.charAt(0).toUpperCase() + user.emailStatus.slice(1)
            : (user.emailSent > 0 ? "Sent" : "Pending")}
        </Badge>
        {/* {user.errorLog && (
          <Tooltip content="Mailing service error - our team has been notified.">
            <Icon source={StatusActiveIcon} tone="critical" />
          </Tooltip>
        )} */}
      </InlineStack>,
      <BlockStack gap="100" key={`dates-${index}`}>
        <Text as="p" variant="bodyMd" fontWeight="medium">
          {new Date(user.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Updated:{" "}
          {new Date(user.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </Text>
      </BlockStack>,
      // <InlineStack gap="200" blockAlign="center" key={`status-${index}`}>
      //   <Badge tone={webhookExists ? "success" : "critical"} size="small">
      //     {webhookExists ? "Auto-Email On" : "Auto-Email Off"}
      //   </Badge>
      // </InlineStack>,
    ];
  });

  const statsCards = [
    {
      title: "Total Subscribers",
      value: users.length.toString(),
      icon: PersonSegmentIcon,
      tone: "success",
      bgColor: "bg-fill-success-secondary",
    },
    {
      title: "Emails Sent",
      value: totalEmailsSent.toString(),
      icon: EmailIcon,
      tone: "info",
      bgColor: "bg-fill-info-secondary",
    },
    {
      title: "System Status",
      value: webhookExists ? "Active" : "Inactive",
      icon: webhookExists ? CheckCircleIcon : StatusActiveIcon,
      tone: webhookExists ? "success" : "critical",
      trend: webhookExists ? "Auto-emails enabled" : "Auto-emails disabled",
      bgColor: webhookExists
        ? "bg-fill-success-secondary"
        : "bg-fill-critical-secondary",
    },
  ];

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => {
        setToastActive(false);
        setToastError(false);
      }}
    />
  ) : null;

  const StatsSkeleton = () => (
    <Box paddingBlockEnd="400">
      {/* <InlineStack gap="400" blockAlign="stretch" align="space-between"> */}
      <Grid columns={3} gap="400">
        {[1, 2, 3].map((item, index) => (
          <Grid.Cell
            key={index}
            columnSpan={{ xs: 4, sm: 3, md: 3, lg: 4, xl: 4 }}
          >
            <Card key={item} padding="200">
              <InlineStack gap="0" blockAlign="center" align="space-evenly">
                <Box
                  padding="400"
                  borderRadius="300"
                  background="bg-fill-tertiary"
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      backgroundColor: "#E0E0E0",
                      borderRadius: "4px",
                    }}
                  />
                </Box>
                <Box padding="400" width="60%">
                  {/* <SkeletonDisplayText size="medium" /> */}
                  <SkeletonBodyText lines={3} />
                </Box>
              </InlineStack>
            </Card>
          </Grid.Cell>
        ))}
      </Grid>
      {/* </InlineStack> */}
    </Box>
  );

  const ActionBarSkeleton = () => (
    <Card padding="500">
      <BlockStack gap="400">
        <InlineStack align="space-between" gap="400">
          <Box padding="" width="40%">
            <BlockStack gap="200">
              <SkeletonDisplayText size="large" />
              <SkeletonBodyText lines={1} />
            </BlockStack>
          </Box>
          <InlineStack gap="200">
            <div
              style={{
                width: "180px",
                height: "35px",
                backgroundColor: "#E0E0E0",
                borderRadius: "6px",
              }}
            />
            <div
              style={{
                width: "180px",
                height: "35px",
                backgroundColor: "#F5F5F5",
                borderRadius: "6px",
              }}
            />
          </InlineStack>
        </InlineStack>

        <Divider />

        <div
          style={{
            padding: "16px",
            backgroundColor: "#FFF9E6",
            borderRadius: "8px",
            border: "1px solid #FFE066",
          }}
        >
          <SkeletonBodyText lines={1} />
        </div>

        <InlineStack gap="400" align="space-between" wrap={false}>
          <Box
            style={{
              minWidth: "60%",
              // flexGrow: 1,
              height: "36px",
              backgroundColor: "#F6F6F6",
              borderRadius: "6px",
              border: "1px solid #E1E1E1",
            }}
          />
          <Box width="40%">
            <InlineStack align="center" gap="300">
              <Box
                style={{
                  width: "30%",
                  height: "36px",
                  backgroundColor: "#E3F2FD",
                  borderRadius: "6px",
                }}
              />
              <Box
                style={{
                  width: "30%",
                  height: "36px",
                  backgroundColor: "#E8F5E8",
                  borderRadius: "6px",
                }}
              />
              <Box
                style={{
                  width: "30%",
                  height: "36px",
                  backgroundColor: "#FFF3E0",
                  borderRadius: "6px",
                }}
              />
            </InlineStack>
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  );

  const TableSkeleton = () => (
    <Card padding="0">
      <BlockStack gap="0">
        <div style={{ padding: "16px" }}>
          <InlineStack align="space-between" blockAlign="center">
            <Box width="40%">
              <BlockStack gap="300" width="40%">
                <SkeletonDisplayText size="medium" />
                <SkeletonBodyText lines={1} />
              </BlockStack>
            </Box>
            <Box width="40%">
              <BlockStack gap="300" align="end" width="40%">
                <InlineStack align="end" gap="300">
                  {/* <SkeletonDisplayText size="small" /> */}
                  <div
                    style={{
                      width: "180px",
                      height: "30px",
                      backgroundColor: "#E0E0E0",
                      borderRadius: "6px",
                    }}
                  />
                  {/* <SkeletonDisplayText size="small" /> */}
                  <div
                    style={{
                      width: "120px",
                      height: "30px",
                      backgroundColor: "#E0E0E0",
                      borderRadius: "6px",
                    }}
                  />
                </InlineStack>
                <SkeletonBodyText lines={1} />
              </BlockStack>
            </Box>
          </InlineStack>
        </div>

        <div style={{ padding: "0 16px 16px 16px" }}>
          <InlineStack gap="400" blockAlign="center">
            <div
              style={{
                width: "120px",
                height: "30px",
                backgroundColor: "#F6F6F6",
                borderRadius: "6px 6px 0 0",
                borderBottom: "2px solid #008060",
              }}
            />
            <div
              style={{
                width: "100px",
                height: "30px",
                backgroundColor: "#FAFAFA",
                borderRadius: "6px 6px 0 0",
              }}
            />
            <div
              style={{
                width: "110px",
                height: "30px",
                backgroundColor: "#FAFAFA",
                borderRadius: "6px 6px 0 0",
              }}
            />
            <div
              style={{
                width: "110px",
                height: "30px",
                backgroundColor: "#FAFAFA",
                borderRadius: "6px 6px 0 0",
              }}
            />
          </InlineStack>
          <Divider />
        </div>

        <div style={{ padding: "20px" }}>
          <BlockStack gap="200">
            <InlineStack gap="100" align="space-between">
              <Box width="24%">
                <SkeletonBodyText lines={1} />
              </Box>
              <Box width="24%">
                <SkeletonBodyText lines={1} />
              </Box>
              <Box width="20%">
                <SkeletonBodyText lines={1} />
              </Box>
              <Box width="18%">
                <SkeletonBodyText lines={1} />
              </Box>
            </InlineStack>

            <Divider />

            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} style={{ padding: "16px 0" }}>
                <InlineStack gap="100" align="space-between">
                  <Box paddingBlockEnd="200" width="24%">
                    <SkeletonBodyText lines={1} />
                  </Box>

                  <Box paddingBlockEnd="200" width="24%">
                    <BlockStack gap="100">
                      <SkeletonBodyText lines={2} />
                    </BlockStack>
                  </Box>

                  <Box paddingBlockEnd="200" width="20%">
                    <div
                      style={{
                        width: "80px",
                        height: "20px",
                        backgroundColor: "#E8F5E8",
                        borderRadius: "10px",
                      }}
                    />
                  </Box>

                  <Box paddingBlockEnd="200" width="18%">
                    <BlockStack gap="100">
                      <SkeletonBodyText lines={2} />
                    </BlockStack>
                  </Box>
                </InlineStack>
                <Divider />
              </div>
            ))}

            <Box paddingBlockStart="400">
              <InlineStack align="center" gap="200">
                <div
                  style={{
                    width: "80px",
                    height: "32px",
                    backgroundColor: "#F6F6F6",
                    borderRadius: "6px",
                  }}
                />
                <SkeletonDisplayText size="small" />
                <div
                  style={{
                    width: "80px",
                    height: "32px",
                    backgroundColor: "#F6F6F6",
                    borderRadius: "6px",
                  }}
                />
              </InlineStack>
              <Box paddingBlockStart="200">
                <InlineStack align="center">
                  <SkeletonBodyText lines={1} />
                </InlineStack>
              </Box>
            </Box>
          </BlockStack>
        </div>
      </BlockStack>
    </Card>
  );

  const handleManualSend = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/webhook?action=manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setToastMessage(result.message || "Manual emails sent successfully");
          setToastError(false);
          refreshData(false); // Refresh user list to see updated status
        } else {
          setToastMessage(result.message || "Failed to send manual emails");
          setToastError(true);
        }
      } else {
        throw new Error("Failed to send manual emails");
      }
    } catch (error) {
      console.error("Error manual send:", error);
      setToastMessage(error.message || "Server Error. No emails were sent.");
      setToastError(true);
    } finally {
      setLoading(false);
      setToastActive(true);
    }
  };

  return (
    <Frame>
      <Page>
        {/* <TitleBar title=" Subscriber Management" /> */}

        <BlockStack gap="400">
          <Layout>
            <Layout.Section>
              {isLoading ? (
                <>
                  <StatsSkeleton />
                  <BlockStack gap="400">
                    <ActionBarSkeleton />
                    <TableSkeleton />
                  </BlockStack>
                </>
              ) : (
                <>
                  <Box paddingBlockEnd="400">
                    <Grid columns={3} gap="400">
                      {statsCards.map((stat, index) => (
                        <Grid.Cell
                          key={index}
                          columnSpan={{ xs: 4, sm: 3, md: 3, lg: 4, xl: 4 }}
                        >
                          <Card padding="0">
                            <div style={{ padding: "15px 15px" }}>
                              <InlineStack gap="400" blockAlign="center">
                                <Box
                                  background={stat.bgColor}
                                  padding="400"
                                  borderRadius="300"
                                >
                                  <Icon source={stat.icon} tone={stat.tone} />
                                </Box>
                                <BlockStack gap="150">
                                  <Text
                                    as="p"
                                    variant="headingMd"
                                    fontWeight="bold"
                                  >
                                    {stat.value}
                                  </Text>
                                </BlockStack>
                                <div>
                                  <Text
                                    as="p"
                                    variant="bodyMd"
                                    fontWeight="medium"
                                  >
                                    {stat.title}
                                  </Text>
                                  <Text as="p" variant="bodySm" tone={stat.tone}>
                                    {stat.trend}
                                  </Text>
                                </div>
                              </InlineStack>
                            </div>
                          </Card>
                        </Grid.Cell>
                      ))}
                    </Grid>
                  </Box>

                  <BlockStack gap="400">
                    <Card padding="500">
                      <BlockStack gap="400">
                        <InlineStack align="space-between" gap="400">
                          <BlockStack gap="200">
                            <Text as="h1" variant="headingXl" fontWeight="bold">
                              Subscriber Dashboard
                            </Text>
                            <Text as="p" tone="subdued" variant="bodyLg">
                              Monitor your subscribers, email notifications, and
                              system status
                            </Text>
                          </BlockStack>
                          <ButtonGroup>
                            <Button
                              variant="primary"
                              icon={EmailIcon}
                              tone={webhookExists ? "success" : "critical"}
                              loading={loading}
                              onClick={handleToggleWebhooks}
                              size="large"
                            >
                              {webhookExists
                                ? "Disable Auto-Emails"
                                : "Enable Auto-Emails"}
                            </Button>
                            <Button
                              variant="secondary"
                              icon={PlusIcon}
                              onClick={() => setShowTemplateEditor(true)}
                              size="large"
                            >
                              Customize Template
                            </Button>
                          </ButtonGroup>
                        </InlineStack>

                        <Divider />

                        <Banner
                          title={`Automatic email notifications are ${webhookExists ? "enabled. Subscribers will be notified automatically when products are back in stock." : "disabled. Subscribers won't be notified automatically when products are restocked."}`}
                          tone={webhookExists ? "success" : "warning"}
                        >
                          <BlockStack gap="200">
                            {/* <Text as="p" variant="bodyMd">
                              {webhookExists
                                ? `System is running smoothly. ${totalEmailsSent} total emails have been sent to ${usersWithEmailsSent} subscribers.`
                                : "Enable the auto-email system to start sending notifications when products are back in stock."}
                            </Text> */}
                            {/* {!webhookExists && (
                              <Text as="p" variant="bodySm" tone="subdued">
                                Click "Enable Auto-Emails" above to activate the
                                notification system.
                              </Text>
                            )} */}
                          </BlockStack>
                        </Banner>

                        <InlineStack gap="400" align="space-between" wrap={false}>
                          <div style={{ minWidth: "350px", flexGrow: 1 }}>
                            <TextField
                              placeholder="Search by email, product ID, or variant ID..."
                              value={searchValue}
                              onChange={handleSearchChange}
                              prefix={<Icon source={SearchIcon} />}
                              clearButton
                              autoComplete="off"
                              onClearButtonClick={() => handleSearchChange("")}
                            />
                          </div>
                          <InlineStack gap="300">
                            <Badge tone="info" size="medium">
                              {tabFilteredUsers.length} subscribers
                            </Badge>
                            <Badge tone="success" size="medium">
                              {totalEmailsSent} emails sent
                            </Badge>
                            <Badge tone="attention" size="medium">
                              {pendingUsers} pending
                            </Badge>
                          </InlineStack>
                        </InlineStack>
                      </BlockStack>
                    </Card>

                    <Card padding="0">
                      <BlockStack gap="0">
                        <div style={{ padding: "24px 24px 0 24px" }}>
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text
                                as="h2"
                                variant="headingLg"
                                fontWeight="medium"
                              >
                                Subscriber Management
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                Monitor email notification history and user
                                engagement
                              </Text>
                            </BlockStack>

                            <BlockStack gap="100" align="end">
                              <ButtonGroup>
                                <Tooltip
                                  active={webhookExists}
                                  content="Disable Auto-Emails to send manually."
                                >
                                  <Button
                                    variant="primary"
                                    icon={EmailIcon}
                                    loading={loading}
                                    onClick={handleManualSend}
                                    size="medium"
                                    disabled={webhookExists || loading}
                                  >
                                    Send Emails Manually
                                  </Button>
                                </Tooltip>
                                {/* ── CHANGED: wired onClick to refreshData + added loading state ── */}
                                <Button
                                  variant="secondary"
                                  icon={RefreshIcon}
                                  onClick={() => refreshData(true)}
                                  loading={isRefreshing}
                                  size="medium"
                                >
                                  Refresh
                                </Button>
                              </ButtonGroup>
                              <Text as="p" variant="bodySm" alignment="end" tone="subdued">
                                Page {currentPage} of {totalPages} • Showing{" "}
                                {currentUsers.length} of {tabFilteredUsers.length}{" "}
                                subscribers
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </div>

                        <div style={{ padding: "0 10px" }}>
                          <Tabs
                            tabs={tabs}
                            selected={selectedTab}
                            onSelect={handleTabChange}
                          />
                        </div>

                        <div style={{ padding: "0 24px 24px 24px" }}>
                          {tabFilteredUsers.length > 0 ? (
                            <BlockStack gap="400">
                              <DataTable
                                columnContentTypes={[
                                  "text",
                                  "text",
                                  "text",
                                  "text",
                                  "text",
                                ]}
                                headings={[
                                  "Subscriber Emails",
                                  "Product Information",
                                  "Email Status",
                                  "Timeline",
                                  // "System Status",
                                ]}
                                rows={userRows}
                                sortable={[true, true, true, true, false]}
                                defaultSortDirection={sortDirection}
                                initialSortColumnIndex={sortColumn}
                                onSort={handleSort}
                                increasedTableDensity={false}
                                verticalAlign="middle"
                                hoverable
                                truncate
                              />

                              {totalPages > 1 && (
                                <Box paddingBlockStart="400">
                                  <InlineStack align="center">
                                    <Pagination
                                      hasPrevious={currentPage > 1}
                                      onPrevious={() =>
                                        setCurrentPage(currentPage - 1)
                                      }
                                      hasNext={currentPage < totalPages}
                                      onNext={() =>
                                        setCurrentPage(currentPage + 1)
                                      }
                                      label={`Page ${currentPage} of ${totalPages}`}
                                    />
                                  </InlineStack>
                                  <Box paddingBlockStart="200">
                                    <InlineStack align="center">
                                      <Text
                                        as="p"
                                        variant="bodySm"
                                        tone="subdued"
                                      >
                                        Showing{" "}
                                        {(currentPage - 1) * itemsPerPage + 1} -{" "}
                                        {Math.min(
                                          currentPage * itemsPerPage,
                                          tabFilteredUsers.length,
                                        )}{" "}
                                        of {tabFilteredUsers.length} subscribers
                                      </Text>
                                    </InlineStack>
                                  </Box>
                                </Box>
                              )}
                            </BlockStack>
                          ) : (
                            <Box paddingBlock="100">
                              <EmptyState
                                heading={
                                  selectedTab === 1
                                    ? "No notified subscribers"
                                    : selectedTab === 2
                                      ? "No pending subscribers"
                                      : searchValue
                                        ? "No subscribers found"
                                        : "No subscribers yet"
                                }
                                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                action={{
                                  content: "Customize Email Template",
                                  onAction: () => setShowTemplateEditor(true),
                                }}
                              >
                                <Text as="p" variant="bodyMd">
                                  {selectedTab === 1
                                    ? "No subscribers have been notified yet. Enable auto-emails to start sending notifications."
                                    : selectedTab === 2
                                      ? "All subscribers have been notified! Great job managing your inventory."
                                      : searchValue
                                        ? "No subscribers match your search criteria. Try adjusting your search terms."
                                        : "No users have subscribed to out-of-stock notifications yet. Share your product pages to start collecting subscribers."}
                                </Text>
                              </EmptyState>
                            </Box>
                          )}
                        </div>
                      </BlockStack>
                    </Card>
                  </BlockStack>
                </>
              )}
            </Layout.Section>
          </Layout>
        </BlockStack>

        <CreateTemplateModal
          email={data.email}
          showTemplateEditor={showTemplateEditor}
          session={session}
          setShowTemplateEditor={setShowTemplateEditor}
          appUrl={appUrl}
        />

        {toastMarkup}
      </Page>
      <FooterHelp>
        <Text variant="bodyMd" monochrome>
          Need help? Contact{' '}
          <Link target="_blank" url="mailto:codecrewdeveloper@gmail.com">
            Support
          </Link>
        </Text>
      </FooterHelp>
    </Frame>
  );
}
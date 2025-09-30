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
  Frame,
  Grid,
  Icon,
  InlineStack,
  Layout,
  Page,
  Pagination,
  SkeletonBodyText,
  SkeletonDisplayText,
  Tabs,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  EmailIcon,
  PersonSegmentIcon,
  PlusIcon,
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
        }
      }
    `);
    shopDetail = (await shopGraphql.json()).data.shop;

    const usersResponse = await fetch(
      `${API_ENDPOINT}?shopName=${encodeURIComponent(shopDetail.name)}`,
    );
    // console.log("usersResponse",usersResponse)
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
    shopName: shopDetail.name,
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
  const [loading, setLoading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedTab, setSelectedTab] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage] = React.useState(10);

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

  const updateShopSettings = async (autoEmailEnabled, webhookActive) => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateShopSettings",
          shopName: data.shopName,
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
                ? "Auto-email notifications disabled - Settings saved"
                : "Auto-email notifications enabled - Settings saved",
            );
          } else {
            setToastMessage(
              webhookExists
                ? "Auto-email notifications disabled - Webhooks deleted"
                : "Auto-email notifications enabled - Webhooks created",
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
        return baseUsers.filter((user) => (user.emailSent || 0) > 0);
      case 2:
        return baseUsers.filter((user) => (user.emailSent || 0) === 0);
      default:
        return baseUsers;
    }
  };

  const getCurrentPageUsers = () => {
    const tabFilteredUsers = getFilteredUsersByTab();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return tabFilteredUsers.slice(startIndex, endIndex);
  };

  const tabFilteredUsers = getFilteredUsersByTab();
  const totalPages = Math.ceil(tabFilteredUsers.length / itemsPerPage);
  const currentUsers = getCurrentPageUsers();

  const totalEmailsSent = users.reduce(
    (total, user) => total + (user.emailSent || 0),
    0,
  );
  const usersWithEmailsSent = users.filter((user) => user.emailSent > 0).length;
  const pendingUsers = users.filter(
    (user) => (user.emailSent || 0) === 0,
  ).length;

  const tabs = [
    {
      id: "all-users",
      content: `All Users (${users.length})`,
      accessibilityLabel: "All users",
      panelID: "all-users-content",
    },
    {
      id: "notified-users",
      content: `Notified (${usersWithEmailsSent})`,
      accessibilityLabel: "Notified users",
      panelID: "notified-users-content",
    },
    {
      id: "pending-users",
      content: `Pending (${pendingUsers})`,
      accessibilityLabel: "Pending users",
      panelID: "pending-users-content",
    },
  ];

  const handleTabChange = (selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
    setCurrentPage(1);
  };

  const userRows = currentUsers.map((user, index) => {
    const emailSentCount = user.emailSent || 0;

    return [
      <InlineStack gap="300" blockAlign="center" key={`user-${index}`}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: emailSentCount > 0 ? "#E3F2FD" : "#F5F5F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            source={PersonSegmentIcon}
            tone={emailSentCount > 0 ? "info" : "subdued"}
          />
        </div>
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="medium">
            {user.email || "No email"}
          </Text>
        </BlockStack>
      </InlineStack>,
      <BlockStack gap="100" key={`product-${index}`}>
        <Text as="p" variant="bodyMd" fontWeight="medium">
          Varinat ID:{user.variantId || "No variant ID"}
        </Text>
      </BlockStack>,
      <InlineStack gap="300" blockAlign="center" key={`emails-${index}`}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: emailSentCount > 0 ? "#E8F5E8" : "#FFF3E0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            source={emailSentCount > 0 ? CheckCircleIcon : StatusActiveIcon}
            tone={emailSentCount > 0 ? "success" : "warning"}
          />
        </div>
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="medium">
            {emailSentCount} email{emailSentCount !== 1 ? "s" : ""}
          </Text>
          <Badge
            tone={emailSentCount > 0 ? "success" : "attention"}
            size="small"
          >
            {emailSentCount > 0 ? "Notified" : "Pending"}
          </Badge>
        </BlockStack>
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
      <InlineStack gap="200" blockAlign="center" key={`status-${index}`}>
        <Badge tone={webhookExists ? "success" : "critical"} size="small">
          {webhookExists ? "Auto-Email On" : "Auto-Email Off"}
        </Badge>
      </InlineStack>,
    ];
  });

  const statsCards = [
    {
      title: "Total Subscribers",
      value: users.length.toString(),
      icon: PersonSegmentIcon,
      tone: "success",
      trend: `${users.length} active subscription${users.length !== 1 ? "s" : ""}`,
      bgColor: "bg-fill-success-secondary",
    },
    {
      title: "Emails Sent",
      value: totalEmailsSent.toString(),
      icon: EmailIcon,
      tone: "info",
      trend: `${usersWithEmailsSent} users notified`,
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
    <Toast content={toastMessage} onDismiss={() => setToastActive(false)} />
  ) : null;

  const StatsSkeleton = () => (
    <Box paddingBlockEnd="600">
      <InlineStack gap="400" blockAlign="stretch">
        {[1, 2, 3].map((item) => (
          <Card key={item} padding="0">
            <div style={{ padding: "24px" }}>
              <InlineStack gap="400" blockAlign="center">
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
                <BlockStack gap="150">
                  <SkeletonDisplayText size="large" />
                  <SkeletonDisplayText size="medium" />
                  <SkeletonBodyText lines={1} />
                </BlockStack>
              </InlineStack>
            </div>
          </Card>
        ))}
      </InlineStack>
    </Box>
  );

  const ActionBarSkeleton = () => (
    <Card padding="500">
      <BlockStack gap="400">
        <InlineStack align="space-between" gap="400">
          <BlockStack gap="200">
            <SkeletonDisplayText size="large" />
            <SkeletonBodyText lines={2} />
          </BlockStack>
          <InlineStack gap="200">
            <div
              style={{
                width: "180px",
                height: "44px",
                backgroundColor: "#E0E0E0",
                borderRadius: "6px",
              }}
            />
            <div
              style={{
                width: "150px",
                height: "44px",
                backgroundColor: "#F5F5F5",
                borderRadius: "6px",
              }}
            />
          </InlineStack>
        </InlineStack>

        <Divider />

        {/* Banner Skeleton */}
        <div
          style={{
            padding: "16px",
            backgroundColor: "#FFF9E6",
            borderRadius: "8px",
            border: "1px solid #FFE066",
          }}
        >
          <BlockStack gap="200">
            <SkeletonDisplayText size="medium" />
            <SkeletonBodyText lines={2} />
          </BlockStack>
        </div>

        {/* Search and Filter Bar Skeleton */}
        <InlineStack gap="400" align="space-between" wrap={false}>
          <div
            style={{
              minWidth: "350px",
              flexGrow: 1,
              height: "36px",
              backgroundColor: "#F6F6F6",
              borderRadius: "6px",
              border: "1px solid #E1E1E1",
            }}
          />
          <InlineStack gap="300">
            <div
              style={{
                width: "100px",
                height: "24px",
                backgroundColor: "#E3F2FD",
                borderRadius: "12px",
              }}
            />
            <div
              style={{
                width: "90px",
                height: "24px",
                backgroundColor: "#E8F5E8",
                borderRadius: "12px",
              }}
            />
            <div
              style={{
                width: "80px",
                height: "24px",
                backgroundColor: "#FFF3E0",
                borderRadius: "12px",
              }}
            />
          </InlineStack>
        </InlineStack>
      </BlockStack>
    </Card>
  );

  const TableSkeleton = () => (
    <Card padding="0">
      <BlockStack gap="0">
        {/* Header Skeleton */}
        <div style={{ padding: "24px 24px 0 24px" }}>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <SkeletonDisplayText size="medium" />
              <SkeletonBodyText lines={1} />
            </BlockStack>
            <SkeletonBodyText lines={1} />
          </InlineStack>
        </div>

        {/* Tabs Skeleton */}
        <div style={{ padding: "0 24px" }}>
          <InlineStack gap="400" blockAlign="center">
            <div
              style={{
                width: "120px",
                height: "40px",
                backgroundColor: "#F6F6F6",
                borderRadius: "6px 6px 0 0",
                borderBottom: "2px solid #008060",
              }}
            />
            <div
              style={{
                width: "100px",
                height: "40px",
                backgroundColor: "#FAFAFA",
                borderRadius: "6px 6px 0 0",
              }}
            />
            <div
              style={{
                width: "110px",
                height: "40px",
                backgroundColor: "#FAFAFA",
                borderRadius: "6px 6px 0 0",
              }}
            />
          </InlineStack>
          <Divider />
        </div>

        {/* Table Content Skeleton */}
        <div style={{ padding: "0 24px 24px 24px" }}>
          <BlockStack gap="200">
            {/* Table Headers */}
            <InlineStack gap="400" align="space-between">
              <SkeletonDisplayText size="small" />
              <SkeletonDisplayText size="small" />
              <SkeletonDisplayText size="small" />
              <SkeletonDisplayText size="small" />
              <SkeletonDisplayText size="small" />
            </InlineStack>

            <Divider />

            {/* Table Rows */}
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} style={{ padding: "16px 0" }}>
                <InlineStack gap="400" align="space-between">
                  {/* Subscriber Details Column */}
                  <InlineStack gap="300" blockAlign="center">
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        backgroundColor: "#F5F5F5",
                      }}
                    />
                    <BlockStack gap="100">
                      <SkeletonDisplayText size="small" />
                    </BlockStack>
                  </InlineStack>

                  {/* Product Information Column */}
                  <BlockStack gap="100">
                    <SkeletonDisplayText size="small" />
                  </BlockStack>

                  {/* Email Status Column */}
                  <InlineStack gap="300" blockAlign="center">
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: "#FFF3E0",
                      }}
                    />
                    <BlockStack gap="100">
                      <SkeletonDisplayText size="small" />
                      <div
                        style={{
                          width: "60px",
                          height: "20px",
                          backgroundColor: "#FFE066",
                          borderRadius: "10px",
                        }}
                      />
                    </BlockStack>
                  </InlineStack>

                  {/* Timeline Column */}
                  <BlockStack gap="100">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={1} />
                  </BlockStack>

                  {/* System Status Column */}
                  <div
                    style={{
                      width: "100px",
                      height: "20px",
                      backgroundColor: "#E8F5E8",
                      borderRadius: "10px",
                    }}
                  />
                </InlineStack>
                <Divider />
              </div>
            ))}

            {/* Pagination Skeleton */}
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

  return (
    <Frame>
      <Page>
        <TitleBar title="Back in Stock Notifications - Subscriber Management" />

        <Layout>
          <Layout.Section>
            {isLoading ? (
              <>
                <StatsSkeleton />
                <ActionBarSkeleton />
                <TableSkeleton />
              </>
            ) : (
              <>
                {/* Enhanced Stats Cards with better design */}
                <Box paddingBlockEnd="600">
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

                {/* Enhanced Action Bar */}
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

                    {/* Enhanced System Status Banner */}
                    <Banner
                      title={`Auto-email system is ${webhookExists ? "active" : "inactive"}`}
                      tone={webhookExists ? "success" : "warning"}
                    >
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd">
                          {webhookExists
                            ? `System is running smoothly. ${totalEmailsSent} total emails have been sent to ${usersWithEmailsSent} subscribers.`
                            : "Enable the auto-email system to start sending notifications when products are back in stock."}
                        </Text>
                        {!webhookExists && (
                          <Text as="p" variant="bodySm" tone="subdued">
                            Click "Enable Auto-Emails" above to activate the
                            notification system.
                          </Text>
                        )}
                      </BlockStack>
                    </Banner>

                    {/* Enhanced Search and Filter Bar */}
                    <InlineStack gap="400" align="space-between" wrap={false}>
                      <div style={{ minWidth: "350px", flexGrow: 1 }}>
                        <TextField
                          placeholder="Search by email, product ID, or variant ID..."
                          value={searchValue}
                          onChange={handleSearchChange}
                          prefix={<Icon source={SearchIcon} />}
                          clearButton
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

                {/* Enhanced Users Data Table with Tabs and Pagination */}
                <Card padding="0">
                  <BlockStack gap="0">
                    {/* Header */}
                    <div style={{ padding: "24px 24px 0 24px" }}>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text as="h2" variant="headingLg" fontWeight="medium">
                            Subscriber Management
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            Monitor email notification history and user
                            engagement
                          </Text>
                        </BlockStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Page {currentPage} of {totalPages} • Showing{" "}
                          {currentUsers.length} of {tabFilteredUsers.length}{" "}
                          subscribers
                        </Text>
                      </InlineStack>
                    </div>

                    {/* Tabs */}
                    <div style={{ padding: "0 24px" }}>
                      <Tabs
                        tabs={tabs}
                        selected={selectedTab}
                        onSelect={handleTabChange}
                      />
                    </div>

                    {/* Table Content */}
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
                              "Subscriber Details",
                              "Product Information",
                              "Email Status",
                              "Timeline",
                              "System Status",
                            ]}
                            rows={userRows}
                            sortable={[true, true, true, true, false]}
                            increasedTableDensity={false}
                            verticalAlign="middle"
                            hoverable
                          />

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <Box paddingBlockStart="400">
                              <InlineStack align="center">
                                <Pagination
                                  hasPrevious={currentPage > 1}
                                  onPrevious={() =>
                                    setCurrentPage(currentPage - 1)
                                  }
                                  hasNext={currentPage < totalPages}
                                  onNext={() => setCurrentPage(currentPage + 1)}
                                  label={`Page ${currentPage} of ${totalPages}`}
                                />
                              </InlineStack>
                              <Box paddingBlockStart="200">
                                <InlineStack align="center">
                                  <Text as="p" variant="bodySm" tone="subdued">
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
                        <Box paddingBlock="800">
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
                            secondaryAction={{
                              content: "Learn more",
                              url: "https://help.shopify.com",
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
              </>
            )}
          </Layout.Section>
        </Layout>

        {/* Template Modal */}
        <CreateTemplateModal
          email={data.email}
          showTemplateEditor={showTemplateEditor}
          session={session}
          setShowTemplateEditor={setShowTemplateEditor}
          appUrl={appUrl}
        />

        {toastMarkup}
      </Page>
    </Frame>
  );
}

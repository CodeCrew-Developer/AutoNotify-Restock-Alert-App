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
  DataTable,
  EmptyState,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonThumbnail,
  Pagination,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate, apiVersion } from "../shopify.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  try {
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
      throw new Error(`Failed to fetch shop details: ${responseOfShop.status}`);
    }

    const shopDetails = await responseOfShop.json();

    const productsResponse = await admin.graphql(
      `
      query getProductsWithInventory($first: Int!) {
        products(first: $first, query: "status:active") {
          edges {
            node {
              id
              title
              handle
              status
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    inventoryQuantity
                    availableForSale
                  }
                }
              }
            }
          }
        }
      }
    `,
      { variables: { first: 100 } },
    );

    const productsJson = await productsResponse.json();
    const products = productsJson.data?.products?.edges || [];

    const outOfStockProducts = [];
    const lowStockProducts = [];
    const allActiveProducts = [];

    products.forEach(({ node: product }) => {
      if (product.status === "ACTIVE") {
        product.variants.edges.forEach(({ node: variant }) => {
          const quantity = variant.inventoryQuantity || 0;
          const productData = {
            productId: product.id,
            productTitle: product.title,
            variantId: variant.id,
            variantTitle: variant.title || "Default",
            price: variant.price,
            quantity,
            availableForSale: variant.availableForSale,
            handle: product.handle,
          };

          allActiveProducts.push(productData);

          if (quantity === 0) {
            outOfStockProducts.push(productData);
          } else if (quantity > 0 && quantity <= 5) {
            lowStockProducts.push(productData);
          }
        });
      }
    });

    return json({
      shopDetails,
      totalProducts: products.length,
      totalActiveVariants: allActiveProducts.length,
      outOfStockCount: outOfStockProducts.length,
      lowStockCount: lowStockProducts.length,
      outOfStockProducts,
      lowStockProducts,
    });
  } catch (error) {
    console.error("Loader error:", error);
    return json({
      shopDetails: null,
      totalProducts: 0,
      totalActiveVariants: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      outOfStockProducts: [],
      lowStockProducts: [],
    });
  }
};

const TableSkeleton = ({ rows = 5 }) => (
  <Card>
    <Box padding="400">
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <SkeletonDisplayText size="medium" />
          <SkeletonThumbnail size="small" />
        </InlineStack>
        
        <Box>
          {Array.from({ length: rows }).map((_, index) => (
            <Box
              key={index}
              paddingBlock="300"
              borderBlockEndWidth="025"
              borderColor="border-subdued"
            >
              <InlineStack gap="400" blockAlign="center">
                <Box width="200px">
                  <SkeletonBodyText lines={1} />
                </Box>
                <Box width="120px">
                  <SkeletonBodyText lines={1} />
                </Box>
                <Box width="80px">
                  <SkeletonBodyText lines={1} />
                </Box>
                <Box width="60px">
                  <SkeletonBodyText lines={1} />
                </Box>
                <Box width="80px">
                  <SkeletonBodyText lines={1} />
                </Box>
                <Box width="100px">
                  <SkeletonThumbnail size="small" />
                </Box>
              </InlineStack>
            </Box>
          ))}
        </Box>
        
        <InlineStack align="center">
          <SkeletonThumbnail size="medium" />
        </InlineStack>
      </BlockStack>
    </Box>
  </Card>
);

const ProductTable = ({ 
  title, 
  products, 
  badge, 
  currentPage, 
  onPageChange, 
  itemsPerPage = 10,
  isLowStock = false 
}) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = products.slice(startIndex, endIndex);
  const totalPages = Math.ceil(products.length / itemsPerPage);

  const headings = isLowStock 
    ? ["Product", "Variant", "Price", "Quantity", "Status", "Action"]
    : ["Product", "Variant", "Price", "Status", "Action"];

  const rows = paginatedProducts.map((product) => {
    const baseRow = [
      product.productTitle,
      product.variantTitle,
      `$${product.price}`,
    ];

    if (isLowStock) {
      baseRow.push(
        product.quantity,
        <Badge tone="warning" key="badge">Low Stock</Badge>
      );
    } else {
      baseRow.push(
        <Badge tone="critical" key="badge">Out of Stock</Badge>
      );
    }

    baseRow.push(
      <Button
        key="action"
        size="slim"
        url={`shopify:admin/products/${product.productId.replace("gid://shopify/Product/", "")}`}
        target="_blank"
      >
        View Product
      </Button>
    );

    return baseRow;
  });

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text as="h2" variant="headingLg">
            {title}
          </Text>
          {badge}
        </InlineStack>

        {products.length > 0 ? (
          <>
            <DataTable
              columnContentTypes={
                isLowStock 
                  ? ["text", "text", "text", "numeric", "text", "text"]
                  : ["text", "text", "text", "text", "text"]
              }
              headings={headings}
              rows={rows}
            />
            {totalPages > 1 && (
              <Box paddingBlockStart="400">
                <Pagination
                  label={`Page ${currentPage} of ${totalPages}`}
                  hasPrevious={currentPage > 1}
                  onPrevious={() => onPageChange(currentPage - 1)}
                  hasNext={currentPage < totalPages}
                  onNext={() => onPageChange(currentPage + 1)}
                />
              </Box>
            )}
          </>
        ) : (
          <EmptyState
            heading={`No ${isLowStock ? 'low stock alerts' : 'out of stock products'}`}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" variant="bodyMd">
              {isLowStock 
                ? "All products have sufficient stock levels."
                : "Great news! All your products are currently in stock."
              }
            </Text>
          </EmptyState>
        )}
      </BlockStack>
    </Card>
  );
};

export default function StockDashboard() {
  const data = useLoaderData();
  
  const [isOutOfStockLoading, setIsOutOfStockLoading] = useState(true);
  const [isLowStockLoading, setIsLowStockLoading] = useState(true);
  
  const [outOfStockPage, setOutOfStockPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);

  useEffect(() => {
    const timer1 = setTimeout(() => setIsOutOfStockLoading(false), 800);
    const timer2 = setTimeout(() => setIsLowStockLoading(false), 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <Page title="Stock Inventory Dashboard">
      <TitleBar title="Stock Inventory Dashboard" />

      <BlockStack gap="500">
        {/* Out of Stock Products */}
        <Layout>
          <Layout.Section>
            {isOutOfStockLoading ? (
              <TableSkeleton rows={5} />
            ) : (
              <ProductTable
                title="Out of Stock Products"
                products={data.outOfStockProducts}
                badge={<Badge tone="critical">{data.outOfStockCount} items</Badge>}
                currentPage={outOfStockPage}
                onPageChange={setOutOfStockPage}
                isLowStock={false}
              />
            )}
          </Layout.Section>
        </Layout>

        {/* Low Stock Products */}
        <Layout>
          <Layout.Section>
            {isLowStockLoading ? (
              <TableSkeleton rows={3} />
            ) : (
              <ProductTable
                title="Low Stock Alert"
                products={data.lowStockProducts}
                badge={<Badge tone="warning">{data.lowStockCount} items</Badge>}
                currentPage={lowStockPage}
                onPageChange={setLowStockPage}
                isLowStock={true}
              />
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
import {
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  ChoiceList,
  Divider,
  InlineStack,
  Layout,
  Modal,
  RangeSlider,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_TEMPLATE = {
  subject: "NOW! The product you subscribed is now restocked!",
  fromEmail: "psychoecokocrow@gmail.com",
  fromName: "Jaydeep learning store",
  post: "default_bert",
  headingColor: "#000000",
  headingContent: "Back to Stock",
  logoImage: null,
  logoWidth: 150,
  logoHeight: 60,
  message:
    "It's nice. We wanted to let you know that your principal will come back as a stock. Because we asked, we made sure that you are the first to borrow but we can't guarantee your team will stay available for long. It's the link below before it's gone!",
  productName: "Pick 2-Senter Chain Right by IELM Design Studio",
  productPrice: "$74.80",
  buttonText: "Buy It Now",
  buttonColor: "#ffffff",
  buttonBackgroundColor: "#4CAF50",
  copyright: "© 2022 Your Store Name",
  footerAlignment: "center",
  headingFontSize: 24,
  messageFontSize: 16,
  productNameFontSize: 16,
  productPriceFontSize: 18,
  buttonFontSize: 16,
  footerFontSize: 12,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const CreateTemplateModal = ({
  showTemplateEditor,
  setShowTemplateEditor,
  session,
  email,
  appUrl,
}) => {
  const API_ENDPOINTS = {
    template: appUrl + "/api/email_template",
    sendMail: appUrl + "/api/sendMail",
    uploadImage: appUrl + "/api/uploadImage",
    showImage: appUrl,
  };
  const shopName = session?.shop;

  const [templateData, setTemplateData] = useState({
    ...DEFAULT_TEMPLATE,
    copyright: `© 2022 ${shopName || "Your Store Name"}`,
  });

  const [testEmail, setTestEmail] = useState(email || "");
  const [loading, setLoading] = useState({
    submit: false,
    test: false,
    fetch: false, // Add fetch loading state
  });
  const [errors, setErrors] = useState({
    api: null,
    test: null,
  });
  const [toast, setToast] = useState("");
  const [templateLoaded, setTemplateLoaded] = useState(false); // Track if template is loaded

  // Helper function to get full image URL
  const getFullImageUrl = useCallback(
    (imagePath) => {
      if (!imagePath) return null;
      // If it's already a full URL, return as is
      if (imagePath.startsWith("http")) return imagePath;
      // Otherwise, prepend the base URL
      return `${API_ENDPOINTS.showImage}/${imagePath}`;
    },
    [API_ENDPOINTS.showImage],
  );

  // Fetch template data - improved with better error handling and loading states
  const fetchTemplate = useCallback(async () => {
    if (!shopName) {
      console.log("No shop name available");
      return;
    }

    setLoading((prev) => ({ ...prev, fetch: true }));
    setTemplateLoaded(false);

    try {
      const response = await fetch(
        `${API_ENDPOINTS.template}?shopName=${encodeURIComponent(shopName)}`,
      );

      if (response.ok) {
        const data = await response.json();

        // Check for the correct API response structure
        let templateExists = false;
        let existingTemplate = null;

        // Handle different API response structures
        if (data?.data?.emailTemplates && data.data.emailTemplates.length > 0) {
          // API returns: { success: true, data: { emailTemplates: [...] } }
          existingTemplate = data.data.emailTemplates[0];
          templateExists = true;
        } else if (data?.template && Object.keys(data.template).length > 0) {
          // API returns: { template: {...} }
          existingTemplate = data.template;
          templateExists = true;
        } else if (data?.emailTemplates && data.emailTemplates.length > 0) {
          // API returns: { emailTemplates: [...] }
          existingTemplate = data.emailTemplates[0];
          templateExists = true;
        }

        if (templateExists && existingTemplate) {
          // Merge with default template to ensure all required fields exist
          const mergedTemplate = {
            ...DEFAULT_TEMPLATE,
            ...existingTemplate,
            copyright: existingTemplate.copyright || `© 2022 ${shopName}`,
          };

          setTemplateData(mergedTemplate);
          setTemplateLoaded(true);
        } else {
          // No existing template found, use default with shop name
          const defaultWithShop = {
            ...DEFAULT_TEMPLATE,
            copyright: `© 2022 ${shopName}`,
          };
          setTemplateData(defaultWithShop);
          setTemplateLoaded(true);
          console.log(
            "No existing template found, using default for shop:",
            shopName,
          );
        }
      } else {
        console.error("Failed to fetch template, status:", response.status);
        // Use default template with shop name on error
        const defaultWithShop = {
          ...DEFAULT_TEMPLATE,
          copyright: `© 2022 ${shopName}`,
        };
        setTemplateData(defaultWithShop);
        setTemplateLoaded(true);
      }
    } catch (error) {
      console.error("Error fetching template:", error);
      // Use default template with shop name on error
      const defaultWithShop = {
        ...DEFAULT_TEMPLATE,
        copyright: `© 2022 ${shopName}`,
      };
      setTemplateData(defaultWithShop);
      setTemplateLoaded(true);
    } finally {
      setLoading((prev) => ({ ...prev, fetch: false }));
    }
  }, [shopName, API_ENDPOINTS.template]);

  // Fetch template data when modal opens or shopName changes
  useEffect(() => {
    if (showTemplateEditor && shopName && !templateLoaded) {
      fetchTemplate();
    }
  }, [showTemplateEditor, shopName, templateLoaded, fetchTemplate]);

  // Reset template loaded state when shop changes
  useEffect(() => {
    if (shopName) {
      setTemplateLoaded(false);
    }
  }, [shopName]);

  // Template field updates
  const updateTemplate = useCallback((field, value) => {
    setTemplateData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateFontSize = useCallback((field, value) => {
    setTemplateData((prev) => ({ ...prev, [field]: parseInt(value) }));
  }, []);

  // Image upload handler
  const handleImageUpload = useCallback(
    async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        setErrors((prev) => ({ ...prev, api: "Image must be less than 5MB" }));
        return;
      }

      if (!file.type.startsWith("image/")) {
        setErrors((prev) => ({
          ...prev,
          api: "Please select a valid image file",
        }));
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(API_ENDPOINTS.uploadImage, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");

        // Store only the relative path in the template data
        updateTemplate("logoImage", data.url); // This will be "uploads/filename"
        setErrors((prev) => ({ ...prev, api: null }));
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          api: `Upload failed: ${error.message}`,
        }));
      }
    },
    [updateTemplate, API_ENDPOINTS.uploadImage],
  );

  // Form validation
  const validateTemplate = useCallback(() => {
    const required = [
      ["subject", "Subject"],
      ["fromEmail", "From email"],
      ["fromName", "From name"],
      ["headingContent", "Heading content"],
      ["message", "Message"],
      ["productName", "Product name"],
      ["productPrice", "Product price"],
      ["buttonText", "Button text"],
      ["copyright", "Copyright"],
    ];

    const errors = required
      .filter(([key]) => !templateData[key]?.trim())
      .map(([, label]) => `${label} is required`);

    if (templateData.fromEmail && !EMAIL_REGEX.test(templateData.fromEmail)) {
      errors.push("Invalid email format");
    }

    return errors;
  }, [templateData]);

  // Generate email HTML
  const generateHTML = useCallback(
    (data = templateData) => {
      const logoImageUrl = getFullImageUrl(data.logoImage);

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.subject}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; max-width: 700px; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #dddddd; padding: 0; }
    .header { text-align: center; padding: 30px 20px 0px 20px; background-color: #ffffff; }
    .logo-image-container { text-align: center; margin-top: 15px; width: 100%; }
    .logo { max-width: ${data.logoWidth}px; max-height: ${data.logoHeight}px; width: ${data.logoWidth}px; height: ${data.logoHeight}px; display: block; margin: 0 auto; object-fit: contain; }
    .heading { color: ${data.headingColor}; font-size: ${data.headingFontSize}px; font-weight: bold; margin: 10px 0 0 0; }
    .content { padding: 0 30px; }
    .message { font-size: ${data.messageFontSize}px; line-height: 1.6; margin: 20px 0; color: #333; }
    .product-section { margin: 30px 0; }
    .product-card { border: 1px solid #e1e1e1; border-radius: 6px; padding: 20px; background-color: #fafafa; margin: 20px 0; }
    .product-content { display: table; width: 100%;}
    .product-image { display: table-cell; width: 130px; height: 130px; background-color: #ffffff; border-radius: 4px; vertical-align: top; }
    .product-details { display: table-cell; padding-left: 15px; vertical-align: top; }
    .product-name { font-size: ${data.productNameFontSize}px; font-weight: bold; color: #333; margin: 0 0 8px 0; line-height: 1.3; }
    .product-price { font-size: ${data.productPriceFontSize}px; font-weight: bold; color: #4CAF50; margin: 0; }
    .button-section { text-align: center; margin: 30px 0; }
    .button { display: inline-block; background-color: ${data.buttonBackgroundColor}; color: ${data.buttonColor} !important; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: ${data.buttonFontSize}px; border: none; }
    .footer { margin-top: 40px; padding: 20px 30px; text-align: ${data.footerAlignment}; font-size: ${data.footerFontSize}px; color: #666; background-color: #f9f9f9; border-top: 1px solid #e1e1e1; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .content { padding: 0 20px; }
      .product-content { display: block; display: flex; gap: 18px;}
      .product-image { display: block; width: 30%; height: 60px; margin-bottom: 15px; }
      .product-details { display: block; padding-left: 0; width:70% }
      .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1 class="heading">${data.headingContent}</h1>
    </div>
    <div class="logo-image-container">
      ${logoImageUrl ? `<img src="${logoImageUrl}" alt="Logo" class="logo">` : ""}
    </div>
    <div class="content">
      <p class="message">${data.message}</p>
      <div class="product-section">
        <div class="product-card">
          <div class="product-content">
            <div class="product-image">
              <img style="background-color: #000; width: 100%; border-radius: 4px; height: 100%;">
            </div>
            <div class="product-details">
              <h3 class="product-name">${data.productName}</h3>
              <p class="product-price">${data.productPrice}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="button-section">
        <a href="#" class="button">${data.buttonText}</a>
      </div>
    </div>
    <div class="footer">
      <p>${data.copyright}</p>
    </div>
  </div>
</body>
</html>`;
    },
    [templateData, getFullImageUrl],
  );

  // API calls
  const handleSubmit = useCallback(async () => {
    const validationErrors = validateTemplate();
    if (validationErrors.length > 0) {
      setErrors((prev) => ({
        ...prev,
        api: `Please fix: ${validationErrors.join(", ")}`,
      }));
      return;
    }

    setLoading((prev) => ({ ...prev, submit: true }));
    setErrors((prev) => ({ ...prev, api: null }));

    try {
      const response = await fetch(API_ENDPOINTS.template, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...templateData,
          shopName,
          createBy: "user",
          htmlTemplate: generateHTML(),
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Error: ${response.status}`);
      }

      setToast("Template saved successfully!");
      setTimeout(() => {
        setShowTemplateEditor(false);
        setToast("");
      }, 2000);
    } catch (error) {
      setErrors((prev) => ({ ...prev, api: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  }, [
    templateData,
    shopName,
    validateTemplate,
    generateHTML,
    setShowTemplateEditor,
    API_ENDPOINTS.template,
  ]);

  const handleSendTest = useCallback(async () => {
    if (!testEmail.trim()) {
      setErrors((prev) => ({ ...prev, test: "Please enter recipient email" }));
      return;
    }
    if (!EMAIL_REGEX.test(testEmail)) {
      setErrors((prev) => ({ ...prev, test: "Invalid email format" }));
      return;
    }

    setLoading((prev) => ({ ...prev, test: true }));
    setErrors((prev) => ({ ...prev, test: null }));

    try {
      const response = await fetch(API_ENDPOINTS.sendMail, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: testEmail,
          subject: templateData.subject,
          fromEmail: templateData.fromEmail,
          fromName: templateData.fromName,
          htmlTemplate: generateHTML(),
          shopName,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Error: ${response.status}`);
      }

      setToast("Test email sent successfully!");
      // setTimeout(() => setToast(""), 3000);
    } catch (error) {
      setErrors((prev) => ({ ...prev, test: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, test: false }));
    }
  }, [testEmail, templateData, shopName, generateHTML, API_ENDPOINTS.sendMail]);

  const handleClose = useCallback(() => {
    setErrors({ api: null, test: null });
    setTemplateLoaded(false); // Reset template loaded state when closing
    setShowTemplateEditor(false);
  }, [setShowTemplateEditor]);

  const dismissError = useCallback((type) => {
    setErrors((prev) => ({ ...prev, [type]: null }));
  }, []);

  // Show loading state while fetching
  if (loading.fetch) {
    return (
      <Modal
        open={showTemplateEditor}
        onClose={handleClose}
        title="Customize Template Design"
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="400" align="center">
            <Text as="p" variant="bodyLg">
              Loading template...
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  return (
    <Modal
      open={showTemplateEditor}
      onClose={handleClose}
      title="Customize Template Design"
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="100">
          {errors.api && (
            <Banner
              title="Error"
              status="critical"
              onDismiss={() => dismissError("api")}
            >
              <p>{errors.api}</p>
            </Banner>
          )}

          {errors.test && (
            <Banner
              title="Test Email Error"
              status="critical"
              onDismiss={() => dismissError("test")}
            >
              <p>{errors.test}</p>
            </Banner>
          )}

          <Layout>
            <Layout.Section variant="oneThird">
              <BlockStack gap="400">
                {/* Test Email */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Send Test Email
                    </Text>
                    <TextField
                      label="Test email recipient"
                      value={testEmail}
                      onChange={setTestEmail}
                      type="email"
                      placeholder="Enter email address"
                    />
                    <Button
                      variant="secondary"
                      onClick={handleSendTest}
                      loading={loading.test}
                      disabled={loading.test || !testEmail.trim()}
                    >
                      {loading.test ? "Sending..." : "Send Test Email"}
                    </Button>
                  </BlockStack>
                </Card>

                {/* Sender Settings */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Sender Settings
                    </Text>
                    <TextField
                      label="Subject"
                      value={templateData.subject}
                      onChange={(v) => updateTemplate("subject", v)}
                    />
                    <TextField
                      label="Send from"
                      value={templateData.fromEmail}
                      onChange={(v) => updateTemplate("fromEmail", v)}
                      type="email"
                    />
                    <TextField
                      label="From name"
                      value={templateData.fromName}
                      onChange={(v) => updateTemplate("fromName", v)}
                    />
                    <TextField
                      label="Post"
                      value={templateData.post}
                      onChange={(v) => updateTemplate("post", v)}
                    />
                  </BlockStack>
                </Card>

                {/* Heading */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Heading
                    </Text>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Color
                      </Text>
                      <InlineStack gap="200" blockAlign="center">
                        <input
                          type="color"
                          value={templateData.headingColor}
                          onChange={(e) =>
                            updateTemplate("headingColor", e.target.value)
                          }
                          style={{
                            width: "40px",
                            height: "40px",
                            border: "none",
                            borderRadius: "4px",
                          }}
                        />
                        <Text variant="bodySm" tone="subdued">
                          {templateData.headingColor}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                    <TextField
                      label="Content"
                      value={templateData.headingContent}
                      onChange={(v) => updateTemplate("headingContent", v)}
                    />
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Font Size: {templateData.headingFontSize}px
                      </Text>
                      <RangeSlider
                        value={templateData.headingFontSize}
                        onChange={(v) => updateFontSize("headingFontSize", v)}
                        min={12}
                        max={48}
                        output
                      />
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* Logo & Content */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Logo & Content
                    </Text>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Upload Logo
                      </Text>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{
                          padding: "12px",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          width: "100%",
                        }}
                      />
                      {templateData.logoImage && (
                        <img
                          src={getFullImageUrl(templateData.logoImage)}
                          alt="Logo preview"
                          style={{
                            maxWidth: "150px",
                            maxHeight: "60px",
                            objectFit: "contain",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                          }}
                        />
                      )}
                    </BlockStack>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Logo Width: {templateData.logoWidth}px
                      </Text>
                      <RangeSlider
                        value={templateData.logoWidth}
                        onChange={(v) => updateFontSize("logoWidth", v)}
                        min={50}
                        max={300}
                        output
                      />
                    </BlockStack>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Logo Height: {templateData.logoHeight}px
                      </Text>
                      <RangeSlider
                        value={templateData.logoHeight}
                        onChange={(v) => updateFontSize("logoHeight", v)}
                        min={20}
                        max={150}
                        output
                      />
                    </BlockStack>
                    <TextField
                      label="Message"
                      value={templateData.message}
                      onChange={(v) => updateTemplate("message", v)}
                      multiline={4}
                    />
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Message Font Size: {templateData.messageFontSize}px
                      </Text>
                      <RangeSlider
                        value={templateData.messageFontSize}
                        onChange={(v) => updateFontSize("messageFontSize", v)}
                        min={10}
                        max={24}
                        output
                      />
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* Product Details */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Product Details
                    </Text>
                    <TextField
                      label="Product Name"
                      value={templateData.productName}
                      onChange={(v) => updateTemplate("productName", v)}
                    />
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Product Name Font Size:{" "}
                        {templateData.productNameFontSize}px
                      </Text>
                      <RangeSlider
                        value={templateData.productNameFontSize}
                        onChange={(v) =>
                          updateFontSize("productNameFontSize", v)
                        }
                        min={10}
                        max={24}
                        output
                      />
                    </BlockStack>
                    <TextField
                      label="Product Price"
                      value={templateData.productPrice}
                      onChange={(v) => updateTemplate("productPrice", v)}
                    />
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Product Price Font Size:{" "}
                        {templateData.productPriceFontSize}px
                      </Text>
                      <RangeSlider
                        value={templateData.productPriceFontSize}
                        onChange={(v) =>
                          updateFontSize("productPriceFontSize", v)
                        }
                        min={10}
                        max={24}
                        output
                      />
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* Button Settings */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Button Settings
                    </Text>
                    <TextField
                      label="Button Text"
                      value={templateData.buttonText}
                      onChange={(v) => updateTemplate("buttonText", v)}
                    />
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Button Font Size: {templateData.buttonFontSize}px
                      </Text>
                      <RangeSlider
                        value={templateData.buttonFontSize}
                        onChange={(v) => updateFontSize("buttonFontSize", v)}
                        min={10}
                        max={24}
                        output
                      />
                    </BlockStack>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Background Color
                      </Text>
                      <InlineStack gap="200" blockAlign="center">
                        <input
                          type="color"
                          value={templateData.buttonBackgroundColor}
                          onChange={(e) =>
                            updateTemplate(
                              "buttonBackgroundColor",
                              e.target.value,
                            )
                          }
                          style={{
                            width: "40px",
                            height: "40px",
                            border: "none",
                            borderRadius: "4px",
                          }}
                        />
                        <Text variant="bodySm" tone="subdued">
                          {templateData.buttonBackgroundColor}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Text Color
                      </Text>
                      <InlineStack gap="200" blockAlign="center">
                        <input
                          type="color"
                          value={templateData.buttonColor}
                          onChange={(e) =>
                            updateTemplate("buttonColor", e.target.value)
                          }
                          style={{
                            width: "40px",
                            height: "40px",
                            border: "none",
                            borderRadius: "4px",
                          }}
                        />
                        <Text variant="bodySm" tone="subdued">
                          {templateData.buttonColor}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* Footer */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Footer
                    </Text>
                    <ChoiceList
                      title="Alignment"
                      choices={[
                        { label: "Left", value: "left" },
                        { label: "Center", value: "center" },
                        { label: "Right", value: "right" },
                      ]}
                      selected={[templateData.footerAlignment]}
                      onChange={(v) => updateTemplate("footerAlignment", v[0])}
                    />
                    <TextField
                      label="Details"
                      value={templateData.copyright}
                      onChange={(v) => updateTemplate("copyright", v)}
                    />
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="medium">
                        Footer Font Size: {templateData.footerFontSize}px
                      </Text>
                      <RangeSlider
                        value={templateData.footerFontSize}
                        onChange={(v) => updateFontSize("footerFontSize", v)}
                        min={8}
                        max={16}
                        output
                      />
                    </BlockStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>

            {/* Preview */}
            <Layout.Section>
              <Card>
                <BlockStack gap="500">
                  <Text as="h2" variant="headingLg">
                    Email Preview
                  </Text>
                  <Box
                    padding="600"
                    background="bg-surface"
                    borderColor="border"
                    borderWidth="025"
                    borderRadius="200"
                  >
                    <BlockStack gap="500">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          Subject: {templateData.subject}
                        </Text>
                        <Divider />
                      </BlockStack>
                      <BlockStack gap="100">
                        <Text variant="bodyMd">
                          <strong>From:</strong> {templateData.fromName} &lt;
                          {templateData.fromEmail}&gt;
                        </Text>
                        <Text variant="bodyMd">
                          <strong>Post:</strong> {templateData.post}
                        </Text>
                      </BlockStack>
                      <Divider />
                      <Box
                        padding="300"
                        background="bg-surface"
                        borderRadius="100"
                        maxHeight="500px"
                        overflow="auto"
                      >
                        <iframe
                          srcDoc={generateHTML()}
                          style={{
                            width: "100%",
                            height: "680px",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                          }}
                          title="Email Preview"
                        />
                      </Box>
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {toast && <Toast content={toast} onDismiss={() => setToast("")} />}

          <Divider />

          <InlineStack align="end">
            <ButtonGroup>
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={loading.submit}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading.submit}
                disabled={loading.submit}
              >
                {loading.submit ? "Saving..." : "Save Template"}
              </Button>
            </ButtonGroup>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default CreateTemplateModal;

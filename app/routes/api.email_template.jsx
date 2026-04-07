import EmailTemplate from "../modes/emailTemplate";

// Default template structure
const DEFAULT_TEMPLATE_DATA = {
  subject: "NOW! The product you subscribed is now restocked!",
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
  createBy: "system",
  htmlTemplate: "",
};

// Function to generate default HTML template
function generateDefaultHTML(shop, logoImage = null) {
  const data = {
    ...DEFAULT_TEMPLATE_DATA,
    logoImage: logoImage || DEFAULT_TEMPLATE_DATA.logoImage,
    copyright: `© 2022 ${shop || "Your Store Name"}`,
  };

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
    .product-details { display: table-cell; padding-left: 20px; vertical-align: top; }
    .product-name { font-size: ${data.productNameFontSize}px; font-weight: bold; color: #333; margin: 0 0 8px 0; line-height: 1.3; }
    .product-price { font-size: ${data.productPriceFontSize}px; font-weight: bold; color: #4CAF50; margin: 0; }
    .button-section { text-align: center; margin: 30px 0; }
    .button { display: inline-block; background-color: ${data.buttonBackgroundColor}; color: ${data.buttonColor} !important; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: ${data.buttonFontSize}px; border: none; }
    .footer { margin-top: 40px; padding: 20px 30px; text-align: ${data.footerAlignment}; font-size: ${data.footerFontSize}px; color: #666; background-color: #f9f9f9; border-top: 1px solid #e1e1e1; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .content { padding: 0 20px; }
      .product-content { display: flex; align-items: flex-start; }
      .product-image { display: block; width: 100px; height: 100px; margin-bottom: 0; flex-shrink: 0; }
      .product-details { display: block; padding-left: 20px; width: auto; flex-grow: 1; }
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
      ${data.logoImage ? `<img src="${data.logoImage}" alt="Logo" class="logo">` : ""}
    </div>
    <div class="content">
      <p class="message">${data.message}</p>
      <div class="product-section">
        <div class="product-card">
          <div class="product-content" style="display: flex;">
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
}

// Function to create default template if it doesn't exist
async function ensureDefaultTemplate(shopName, logoImage = null) {
  if (!shopName) return null;

  try {
    const existingTemplate = await EmailTemplate.findOne({ shopName });

    if (!existingTemplate) {
      console.log(`📝 Creating default template for shop: ${shopName}`);

      const defaultTemplate = new EmailTemplate({
        shopName,
        ...DEFAULT_TEMPLATE_DATA,
        logoImage: logoImage || DEFAULT_TEMPLATE_DATA.logoImage,
        copyright: `© 2022 ${shopName}`,
        htmlTemplate: generateDefaultHTML(shopName, logoImage),
        timestamp: new Date(),
      });

      const savedTemplate = await defaultTemplate.save();
      console.log(`✅ Default template created for shop: ${shopName}`);
      return savedTemplate;
    }

    return existingTemplate;
  } catch (error) {
    console.error(`❌ Error ensuring default template for ${shopName}:`, error);
    return null;
  }
}

export async function loader({ request }) {
  try {
    const url = new URL(request.url);

    const name = url.searchParams.get("name") || "Guest";
    const shopName = url.searchParams.get("shopName");
    const logoURL = url.searchParams.get("logoURL");
    const limit = url.searchParams.get("limit");
    const page = url.searchParams.get("page");

    let query = {};
    let options = {};

    if (shopName) {
      console.log(`🔍 Fetching templates for shop: ${shopName}`);
      query.shopName = shopName;
      // Ensure default template exists for this shop
      await ensureDefaultTemplate(shopName, logoURL);
    }

    if (limit) {
      options.limit = parseInt(limit);
    }

    if (page && limit) {
      options.skip = (parseInt(page) - 1) * parseInt(limit);
    }

    const emailTemplates = await EmailTemplate.find(query, null, options);

    const totalCount = await EmailTemplate.countDocuments(query);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          emailTemplates,
          totalCount,
          currentPage: page ? parseInt(page) : 1,
          limit: limit ? parseInt(limit) : emailTemplates.length,
          name
        },
        message: "Email templates retrieved successfully"
      }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error in email template loader:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch email templates",
        message: error.message
      }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
}

export async function action({ request }) {
  const emailtemplateData = await request.json();
  const template = await EmailTemplate.findOneAndUpdate(
    { shopName: emailtemplateData.shopName },
    { $set: emailtemplateData },
    { upsert: true, new: true },
  );

  return new Response(
    JSON.stringify({
      message: "POST received",
      receivedData: emailtemplateData,
      template,
    }),
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
      },
    },
  );
}

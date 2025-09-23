import EmailTemplate from "../modes/emailTemplate";


export async function loader({ request }) {
  try {
    const url = new URL(request.url);
    
    const name = url.searchParams.get("name") || "Guest";
    const shopName = url.searchParams.get("shopName");
    const limit = url.searchParams.get("limit");
    const page = url.searchParams.get("page");

    let query = {};
    let options = {};

    if (shopName) {
      query.shopName = shopName;
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

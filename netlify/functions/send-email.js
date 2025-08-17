// Netlify serverless function to send transactional emails via Mailgun
// This function expects a JSON body with the following properties:
//   to: recipient email address (string)
//   subject: email subject line (string)
//   text: plain text version of the email (string)
//   html: HTML version of the email (string)
// It returns a JSON response indicating success or failure.

const buildCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

exports.handler = async (event) => {
  const {
    MAILGUN_API_KEY,
    MAILGUN_DOMAIN,
    MAILGUN_REGION = "us",
    MAILGUN_FROM,
    CORS_ORIGIN,
  } = process.env;

  const corsHeaders = buildCorsHeaders(CORS_ORIGIN);

  // Handle preflight requests for CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "OK" };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Validate required environment variables
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !MAILGUN_FROM) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error:
          "Server misconfiguration: missing MAILGUN_API_KEY, MAILGUN_DOMAIN, or MAILGUN_FROM",
      }),
    };
  }

  // Parse the request body
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }
  const { to, subject, text, html, cc, bcc, replyTo } = payload;

  // Validate required fields
  if (!to || !subject || (!text && !html)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Required fields: to, subject, and (text or html)",
      }),
    };
  }

  // Basic email hygiene: prevent sending to arbitrary domains if desired
  // Uncomment to enforce an allow list of domains
  // const allowedDomains = ["gmail.com", "yahoo.com", "outlook.com"];
  // if (!allowedDomains.some((d) => String(to).endsWith(`@${d}`))) {
  //   return {
  //     statusCode: 400,
  //     headers: corsHeaders,
  //     body: JSON.stringify({ error: "Recipient domain not allowed" }),
  //   };
  // }

  // Determine Mailgun API endpoint based on region
  const apiBase = MAILGUN_REGION.toLowerCase() === "eu"
    ? "https://api.eu.mailgun.net"
    : "https://api.mailgun.net";
  const url = `${apiBase}/v3/${MAILGUN_DOMAIN}/messages`;

  // Build URL-encoded body using URLSearchParams. Mailgun accepts both
  // application/x-www-form-urlencoded and multipart/form-data; using
  // URLSearchParams avoids the need for FormData in the Node environment.
  const params = new URLSearchParams();
  params.append("from", MAILGUN_FROM);
  params.append("to", to);
  if (cc) params.append("cc", cc);
  if (bcc) params.append("bcc", bcc);
  if (replyTo) params.append("h:Reply-To", replyTo);
  params.append("subject", subject);
  if (text) params.append("text", text);
  if (html) params.append("html", html);

  // HTTP Basic auth header for Mailgun
  const auth =
    "Basic " + Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

  try {
    const mgRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const contentType = mgRes.headers.get("content-type") || "";
    const responseBody = contentType.includes("application/json")
      ? await mgRes.json()
      : await mgRes.text();

    if (!mgRes.ok) {
      return {
        statusCode: mgRes.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Mailgun error", details: responseBody }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, result: responseBody }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Request failed", details: String(err) }),
    };
  }
};
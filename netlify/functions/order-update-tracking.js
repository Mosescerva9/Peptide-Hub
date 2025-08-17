// Netlify function: order-update-tracking
// Updates an order's tracking information in Supabase and emails the customer the tracking link.  
// Expects a POST body with JSON fields:
//   orderId (string), trackingNumber (string), optional carrier (string), trackingUrl (string)

async function sendMail({ to, subject, text, html }) {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_REGION = "us", MAILGUN_FROM } = process.env;
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !MAILGUN_FROM) {
    throw new Error("Mailgun env vars missing");
  }
  const apiBase = MAILGUN_REGION.toLowerCase() === "eu"
    ? "https://api.eu.mailgun.net"
    : "https://api.mailgun.net";
  const url = `${apiBase}/v3/${MAILGUN_DOMAIN}/messages`;
  const form = new URLSearchParams();
  form.set("from", MAILGUN_FROM);
  form.set("to", to);
  form.set("subject", subject);
  if (text) form.set("text", text);
  if (html) form.set("html", html);
  const auth =
    "Basic " + Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

const buildCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

function safeParse(b) {
  try {
    return JSON.parse(b || "{}");
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  const cors = buildCorsHeaders(process.env.CORS_ORIGIN);
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "OK" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method not allowed" };
  }
  const payload = safeParse(event.body);
  if (!payload) {
    return { statusCode: 400, headers: cors, body: "Invalid JSON" };
  }
  const { orderId, trackingNumber, carrier, trackingUrl } = payload;
  if (!orderId || !trackingNumber) {
    return { statusCode: 400, headers: cors, body: "orderId and trackingNumber required" };
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
  // Update order in Supabase and return updated row
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        carrier: carrier || null,
        tracking_url: trackingUrl || null,
        status: "shipped",
      }),
    }
  );
  if (!updateRes.ok) {
    return { statusCode: updateRes.status, headers: cors, body: await updateRes.text() };
  }
  const rows = await updateRes.json();
  if (!rows || !rows.length) {
    return { statusCode: 404, headers: cors, body: "Order not found" };
  }
  const row = rows[0];
  // Compose tracking email
  const html = `<div style="font-family:Arial,Helvetica,sans-serif">
    <h2>Your package is on the way 🎉</h2>
    <p>Order <strong>${orderId}</strong></p>
    <p>Carrier: <strong>${carrier || "—"}</strong><br>
       Tracking: <a href="${trackingUrl || '#'}">${trackingNumber}</a></p>
  </div>`;
  const text = `Your package is on the way! Order ${orderId}. Carrier: ${carrier || "-"} Tracking: ${trackingUrl || trackingNumber}`;
  // Send email to customer
  await sendMail({
    to: row.email,
    subject: `Tracking for order ${orderId}`,
    text,
    html,
  });
  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};

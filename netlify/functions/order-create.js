// Netlify function: order-create
// Creates a new order in Supabase, emails the customer payment instructions, and
// optionally emails your supplier with the shipping details.  
// The request body must include:
//   customer: { email, phone?, ship_name, ship_address1, ship_address2?, ship_city, ship_state, ship_postal, ship_country?, same_billing?, bill_name?, bill_address1?, bill_address2?, bill_city?, bill_state?, bill_postal?, bill_country? }
//   cart: [ { name, size, price, qty, ... } ]
//   payment_method: "cashapp" | "venmo" | "zelle" | "bitcoin" | ...
// Returns: { ok: true, orderId, total, method }

// Send an email via Mailgun using environment variables configured in Netlify
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
  const mgRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!mgRes.ok) {
    const err = await mgRes.text();
    throw new Error(`Mailgun error: ${err}`);
  }
}

// Safe JSON parser to avoid exceptions
function safeParse(body) {
  try {
    return JSON.parse(body || "{}");
  } catch {
    return null;
  }
}

// Generate a pseudo-random order ID with prefix "PC" followed by 7 digits
function genOrderId() {
  const n = Math.floor(1000000 + Math.random() * 9000000);
  return "PC" + n;
}

// Insert a new order into Supabase using the REST interface
async function insertOrder(row) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Supabase insert failed: " + txt);
  }
  return await res.json();
}

// Build CORS headers based on allowed origin
const buildCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

exports.handler = async (event) => {
  const cors = buildCorsHeaders(process.env.CORS_ORIGIN);
  // Preflight request for CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "OK" };
  }
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method not allowed" };
  }
  // Parse payload
  const payload = safeParse(event.body);
  if (!payload) {
    return { statusCode: 400, headers: cors, body: "Invalid JSON" };
  }
  const cart = Array.isArray(payload.cart) ? payload.cart : [];
  const customer = payload.customer || {};
  const method = String(payload.payment_method || "").toLowerCase();

  // Validate required fields
  const required = [
    "email",
    "ship_name",
    "ship_address1",
    "ship_city",
    "ship_state",
    "ship_postal",
    "ship_country",
  ];
  for (const k of required) {
    if (!customer[k] || String(customer[k]).trim() === "") {
      return {
        statusCode: 400,
        headers: cors,
        body: `Missing field: ${k}`,
      };
    }
  }
  if (!cart.length) {
    return { statusCode: 400, headers: cors, body: "Cart is empty" };
  }
  if (!method) {
    return { statusCode: 400, headers: cors, body: "payment_method required" };
  }
  // Compute total from cart
  let total = 0;
  for (const item of cart) {
    total += Number(item.price || 0) * Number(item.qty || 0);
  }
  total = Number(total.toFixed(2));
  // Base row for Supabase
  const base = {
    email: customer.email,
    phone: customer.phone || null,
    ship_name: customer.ship_name,
    ship_address1: customer.ship_address1,
    ship_address2: customer.ship_address2 || null,
    ship_city: customer.ship_city,
    ship_state: customer.ship_state,
    ship_postal: customer.ship_postal,
    ship_country: customer.ship_country || "US",
    billing_same: customer.same_billing !== false,
    bill_name: customer.bill_name || null,
    bill_address1: customer.bill_address1 || null,
    bill_address2: customer.bill_address2 || null,
    bill_city: customer.bill_city || null,
    bill_state: customer.bill_state || null,
    bill_postal: customer.bill_postal || null,
    bill_country: customer.bill_country || null,
    items: cart,
    payment_method: method,
    total,
    status: "pending",
  };
  // Insert order with unique ID
  let orderId;
  let inserted;
  for (let i = 0; i < 5; i++) {
    orderId = genOrderId();
    try {
      inserted = await insertOrder({ ...base, order_id: orderId });
      break;
    } catch (e) {
      // If duplicate, retry; else propagate error
      if (!String(e).toLowerCase().includes("duplicate")) throw e;
    }
  }
  if (!inserted) {
    return {
      statusCode: 500,
      headers: cors,
      body: "Could not create unique order_id",
    };
  }
  // Compose email instructions for customer
  const supportEmail = process.env.SUPPORT_EMAIL || "support@yourdomain.com";
  const supportPhone = process.env.SUPPORT_PHONE || "(555) 555-5555";
  const amount = `$${total.toFixed(2)}`;
  let steps = "";
  if (method === "cashapp") {
    steps = `Open Cash App and send <b>${amount}</b> to <b>$PeptideCo</b>. Note: <b>${orderId}</b>.`;
  } else if (method === "venmo") {
    steps = `Open Venmo and pay <b>${amount}</b> to <b>@PeptideCo</b>. Memo: <b>${orderId}</b>.`;
  } else if (method === "zelle") {
    steps = `Send <b>${amount}</b> via Zelle to <b>support@peptideco.com</b>. Memo: <b>${orderId}</b>.`;
  } else if (method === "bitcoin") {
    steps = `Use the BTC address shown after checkout to send <b>${amount}</b>. Include <b>${orderId}</b> if your wallet allows.`;
  } else {
    steps = `Follow the instructions shown after checkout.`;
  }
  const customerHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif">
      <h2>Thanks for your order!</h2>
      <p>Order <strong>${orderId}</strong> was received.</p>
      <p><strong>How to pay:</strong> ${steps}</p>
      <p>After you pay, please email or text your proof to <b>${supportEmail}</b> or <b>${supportPhone}</b>.</p>
      <p>You’ll receive another email with tracking once it’s available.</p>
    </div>
  `;
  const customerText = (
    `Thanks for your order! Order ${orderId} was received. How to pay: ` +
    steps.replace(/<[^>]+>/g, "") +
    ` After you pay, please email or text proof to ${supportEmail} or ${supportPhone}. ` +
    `You’ll receive another email with tracking once it’s available.`
  );
  // Send email to customer
  await sendMail({
    to: customer.email,
    subject: `Your order ${orderId} – payment instructions`,
    text: customerText,
    html: customerHtml,
  });
  // Optionally email supplier
  if (process.env.SUPPLIER_EMAIL) {
    const supplierEmail = process.env.SUPPLIER_EMAIL;
    // Build shipping address
    const addrLines = [
      base.ship_name,
      base.ship_address1,
      base.ship_address2,
      `${base.ship_city}, ${base.ship_state} ${base.ship_postal}`,
      base.ship_country,
    ].filter(Boolean);
    const addr = addrLines.join("\n");
    // Build items list as plain text
    const itemsText = cart
      .map((i) => `- ${i.name} (${i.size}) x${i.qty} @ $${i.price}`)
      .join("\n");
    const supplierText = `New order ${orderId}\n\nShip to:\n${addr}\n\nItems:\n${itemsText}\n\nTotal: $${total.toFixed(2)}\nPayment method: ${method}\nCustomer email: ${customer.email}`;
    // Escape HTML for items
    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    const itemsHtml = escapeHtml(itemsText).replace(/\n/g, "<br>");
    const supplierHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h3>New order ${orderId}</h3>
        <p><b>Ship to:</b><br>${addrLines.map((l) => escapeHtml(l)).join("<br>")}</p>
        <p><b>Items:</b><br><pre style="background:#f8f9fb;padding:10px;border-radius:8px">${itemsHtml}</pre></p>
        <p><b>Total:</b> $${total.toFixed(2)}<br><b>Payment method:</b> ${method}<br><b>Customer email:</b> ${escapeHtml(customer.email)}</p>
      </div>
    `;
    await sendMail({
      to: supplierEmail,
      subject: `New order ${orderId} – ship this`,
      text: supplierText,
      html: supplierHtml,
    });
  }
  // Return success response
  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, orderId, total, method }),
  };
};

# Orders System Starter (Netlify + Supabase + Mailgun)

This folder contains everything you need to add a simple, working order database and email workflow to your Netlify‑hosted Peptide site.  
The goal is to store each customer’s name, address, cart and payment method, and automatically send them payment instructions after checkout. You can also update orders with tracking numbers later and trigger a tracking email.

## Included files

| File | Purpose |
|---|---|
| `schema.sql` | SQL to create an `orders` table in Supabase (run in the Supabase SQL editor). |
| `.env.example` | Example environment variables for local development (copy to `.env` and fill in). |
| `netlify/functions/order-create.js` | Netlify serverless function to save an order in Supabase, email the customer payment instructions and optionally email your supplier. |
| `netlify/functions/order-update-tracking.js` | Netlify serverless function to update tracking info in Supabase and email the customer their tracking details. |
| `netlify/functions/send-email.js` | Existing Mailgun helper (already used in checkout for simple emails). |
| `netlify.toml` | Tells Netlify where your functions directory lives. |
| `checkout.html` | Your checkout form (modified separately) should call the `order-create` function. |
| `payment-instructions.html` | Displays payment instructions after checkout (already modified to remove proof upload). |

## Setup steps

1. **Create your database (Supabase)**
   * Sign up at [supabase.com](https://supabase.com) and create a new project.
   * Open the **SQL Editor** in Supabase and run the contents of `schema.sql` to create the `orders` table.
   * Copy your **Project URL** and **service_role** key (found under Project Settings → API).

2. **Add environment variables in Netlify**
   In your site’s settings on Netlify, add the following variables (and fill them with real values):
   - `SUPABASE_URL` – e.g., `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE` – the service role key (server‑only; never expose it on the frontend)
   - `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_REGION`, `MAILGUN_FROM` – already set if you configured Mailgun earlier
   - `CORS_ORIGIN` – your site origin, e.g., `https://thepeptidehub.net`
   - Optional: `SUPPLIER_EMAIL` – where to send new order notifications, `SUPPORT_EMAIL`, `SUPPORT_PHONE`

3. **Hook up your checkout**
   Modify your checkout JavaScript so that when the user submits their order, you collect the customer info, cart items and selected payment method, then POST them to your Netlify function:

```js
// Build payload for the order-create function
const customer = {
  email: document.getElementById('email').value,
  phone: document.getElementById('phone').value,
  ship_name: document.getElementById('ship_name').value,
  ship_address1: document.getElementById('ship_address1').value,
  ship_address2: document.getElementById('ship_address2').value,
  ship_city: document.getElementById('ship_city').value,
  ship_state: document.getElementById('ship_state').value,
  ship_postal: document.getElementById('ship_postal').value,
  ship_country: document.getElementById('ship_country').value,
  same_billing: document.getElementById('same_billing').checked,
  bill_name: document.getElementById('bill_name').value,
  bill_address1: document.getElementById('bill_address1').value,
  bill_address2: document.getElementById('bill_address2').value,
  bill_city: document.getElementById('bill_city').value,
  bill_state: document.getElementById('bill_state').value,
  bill_postal: document.getElementById('bill_postal').value,
  bill_country: document.getElementById('bill_country').value,
};
const cart = JSON.parse(localStorage.getItem('ph_cart') || '[]');
const paymentMethod = document.querySelector('.pay.selected')?.dataset.method;

const resp = await fetch('/.netlify/functions/order-create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customer, cart, payment_method: paymentMethod })
});
const data = await resp.json();

// Save order info and go to payment instructions page
localStorage.setItem('orderId', data.orderId);
localStorage.setItem('orderTotal', Number(data.total).toFixed(2));
localStorage.setItem('method', paymentMethod);
location.href = `payment-instructions.html?method=${paymentMethod}&order=${data.orderId}&total=${Number(data.total).toFixed(2)}`;
```

4. **Update tracking later**
   When your supplier provides tracking, call the `order-update-tracking` function (e.g., from a simple admin UI or via curl). Example:

```bash
curl -X POST https://YOUR_SITE/.netlify/functions/order-update-tracking \
  -H "Content-Type: application/json" \
  -d '{"orderId":"PC1234567","trackingNumber":"1Z999...","carrier":"UPS","trackingUrl":"https://wwwapps.ups.com/WebTracking/..."}'
```

This will update the order’s status to `shipped` in Supabase and email the customer their tracking link.
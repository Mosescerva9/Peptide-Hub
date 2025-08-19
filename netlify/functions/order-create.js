// Netlify Function (v2) to create a new order in Neon Postgres.
//
// This function expects a JSON payload with the following fields:
// - email (string, required)
// - name (string, optional)
// - address_line1 (string, optional)
// - address_line2 (string, optional)
// - city (string, optional)
// - state (string, optional)
// - postal_code (string, optional)
// - country (string, optional)
// - items (array of objects with sku, name, qty, price)
// - subtotal_cents (number, required)
// - payment_method (string, required)
//
// Returns the created order ID on success.

export default async (request, context) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const {
      email,
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      items,
      subtotal_cents,
      payment_method,
      address,
    } = body;

    // Normalize address fields from either top-level keys or nested `address` object. This allows
    // clients to send address as { line1, line2, city, state, postal_code, country } or
    // as top‑level snake_cased fields. We also support camelCase fallback for common frontends.
    const line1 = address_line1 ?? address?.line1 ?? address?.address_line1 ?? address?.addressLine1 ?? null;
    const line2 = address_line2 ?? address?.line2 ?? address?.address_line2 ?? address?.addressLine2 ?? null;
    const cityVal = city ?? address?.city ?? null;
    const stateVal = state ?? address?.state ?? null;
    const postalCodeVal = postal_code ?? address?.postal_code ?? address?.postalCode ?? null;
    const countryVal = country ?? address?.country ?? null;

    // Accept both array and object forms for items. If an object is provided, use its values.
    const itemsArr = Array.isArray(items)
      ? items
      : items && typeof items === 'object'
      ? Object.values(items)
      : [];

    // Basic validation
    if (!email || !itemsArr.length || typeof subtotal_cents !== 'number' || !payment_method) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, items, subtotal_cents, payment_method' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Connect to Neon using Netlify's built‑in driver
    const { sql } = await import('@netlify/neon');

    const result = await sql`
      INSERT INTO public.orders (
        email,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        items,
        subtotal_cents,
        payment_method
      )
      VALUES (
        ${email},
        ${name ?? null},
        ${line1},
        ${line2},
        ${cityVal},
        ${stateVal},
        ${postalCodeVal},
        ${countryVal},
        ${JSON.stringify(itemsArr)},
        ${subtotal_cents},
        ${payment_method}
      )
      RETURNING id, created_at;
    `;

    const { id, created_at } = result[0];

    return new Response(
      JSON.stringify({ id, created_at }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('order-create error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
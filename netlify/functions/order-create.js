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
    } = body;

    // Basic validation
    if (!email || !Array.isArray(items) || !items.length || !subtotal_cents || !payment_method) {
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
        ${address_line1 ?? null},
        ${address_line2 ?? null},
        ${city ?? null},
        ${state ?? null},
        ${postal_code ?? null},
        ${country ?? null},
        ${JSON.stringify(items)},
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
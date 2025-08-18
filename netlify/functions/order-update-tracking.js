// Netlify Function (v2) to update tracking information for an order.
//
// Expects a JSON payload with:
// - id (string, required): the UUID of the order
// - tracking_number (string, required)
//
// Sets the tracking_number on the order and optionally updates status to 'fulfilled'.

export default async (request, context) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { id, tracking_number } = body;

    if (!id || !tracking_number) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: id and tracking_number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { sql } = await import('@netlify/neon');

    await sql`
      UPDATE public.orders
      SET tracking_number = ${tracking_number},
          status = 'fulfilled'
      WHERE id = ${id};
    `;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('order-update-tracking error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
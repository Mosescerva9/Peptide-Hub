// Netlify Function (v2) to mark an order as paid.
//
// This function expects a JSON payload with:
// - id (string, required): the UUID of the order to update
// - payment_proof (string, optional): data URL or reference to payment proof
//
// It updates the order's status to 'paid' and stores the optional payment proof.

export default async (request, context) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { id, payment_proof } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing required field: id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { sql } = await import('@netlify/neon');

    await sql`
      UPDATE public.orders
      SET status = 'paid',
          payment_proof = ${payment_proof ?? null}
      WHERE id = ${id};
    `;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('order-mark-paid error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
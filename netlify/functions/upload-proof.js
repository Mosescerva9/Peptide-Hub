// Netlify Function (v2) to upload payment proof.
//
// This is a legacy compatibility function. It expects a JSON payload with:
// - id (string, required): order ID
// - data_url (string, required): base64‑encoded image or other proof
//
// It stores the data_url directly in the payment_proof column. You may
// later migrate to Netlify Blobs for better storage and replace
// payment_proof with a URL.

export default async (request, context) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id, data_url } = await request.json();
    if (!id || !data_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: id and data_url' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { sql } = await import('@netlify/neon');
    await sql`
      UPDATE public.orders
      SET payment_proof = ${data_url},
          status = 'paid'
      WHERE id = ${id};
    `;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('upload-proof error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
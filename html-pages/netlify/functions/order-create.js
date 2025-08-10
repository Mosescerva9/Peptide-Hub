// netlify/functions/order-create.js
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      email, name,
      address_line1, address_line2, city, state, postal_code, country,
      items, subtotal_cents, payment_method
    } = body;

    if (!email || !Array.isArray(items)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payload' }) };
    }

    // 1) Save the order
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        email, name,
        address_line1, address_line2, city, state, postal_code, country,
        items, subtotal_cents, payment_method,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // 2) Send confirmation email
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: `We got your order — #${data.id.slice(0,8)}`,
      html: `
        <div>
          <h2>Order received!</h2>
          <p>Order ID: <b>${data.id}</b></p>
          <p>Payment method: <b>${payment_method}</b></p>
          <p>Total: $${(subtotal_cents/100).toFixed(2)}</p>
          <h3>What's next?</h3>
          <ol>
            <li>Complete payment via ${String(payment_method).toUpperCase()} (see checkout instructions).</li>
            <li>You'll get another email with tracking once it ships.</li>
          </ol>
          <h3>Items</h3>
          <ul>${items.map(i => `<li>${i.qty} × ${i.name}</li>`).join('')}</ul>
        </div>`
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, orderId: data.id }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};

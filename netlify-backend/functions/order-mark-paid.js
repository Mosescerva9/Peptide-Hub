// netlify/functions/order-mark-paid.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const auth = event.headers.authorization || '';
  if (auth !== `Bearer ${process.env.TRACKING_UPDATE_TOKEN}`) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { orderId } = JSON.parse(event.body || '{}');
    if (!orderId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing orderId' }) };

    // 1) Mark as paid
    const { data: order, error } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', orderId)
      .select()
      .single();
    if (error || !order) throw error || new Error('Order not found');

    // 2) OPTIONAL: Call supplier API here (if they have one)
    // const resp = await fetch('https://supplier.example.com/api/orders', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SUPPLIER_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     order_ref: order.id,
    //     ship_to: {
    //       name: order.name,
    //       address_line1: order.address_line1,
    //       address_line2: order.address_line2,
    //       city: order.city,
    //       state: order.state,
    //       postal_code: order.postal_code,
    //       country: order.country
    //     },
    //     items: order.items.map(i => ({ sku: i.sku, qty: i.qty }))
    //   })
    // }).then(r => r.json());

    // await supabase.from('orders')
    //   .update({ supplier_order_id: resp.id, status: 'submitted_to_supplier' })
    //   .eq('id', orderId);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
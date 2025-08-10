// netlify/functions/upload-proof.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { orderId, email, method, amount, imageData } = body;

    if (!orderId || !imageData) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Missing required fields (orderId, imageData).' }),
      };
    }

    // Expect data:image/...;base64,AAAA...
    let mime = 'image/png';
    let b64 = imageData;
    const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(imageData);
    if (m) { mime = m[1]; b64 = m[2]; }

    const buffer = Buffer.from(b64, 'base64');

    const proofs = getStore('proofs');            // uses (or creates) a store named "proofs"
    const ext = (mime.split('/')[1] || 'png').toLowerCase();
    const safeId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${safeId}-${Date.now()}.${ext}`;

    // Write the raw buffer; provide content type as a hint
    await proofs.set(key, buffer, { contentType: mime });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, key, orderId, email, method, amount, message: 'Proof image stored.' }),
    };
  } catch (err) {
    console.error('upload-proof error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message || 'Upload failed.' }),
    };
  }
};

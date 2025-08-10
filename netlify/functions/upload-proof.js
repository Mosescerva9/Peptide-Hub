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
        body: JSON.stringify({ ok: false, error: 'Missing required fields (orderId, imageData).' }),
      };
    }

    // Expect data:image/png;base64,...
    let mime = 'image/png';
    let b64 = imageData;
    const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(imageData);
    if (m) {
      mime = m[1];
      b64 = m[2];
    }

    const buffer = Buffer.from(b64, 'base64');

    const proofs = getStore('proofs');
    const ext = mime.split('/')[1] || 'png';
    const key = `${orderId}-${Date.now()}.${ext}`;
    const blob = new Blob([buffer], { type: mime });

    await proofs.set(key, blob);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        key,
        orderId,
        email,
        method,
        amount,
        message: 'Proof image stored.',
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Upload failed.' }) };
  }
};

// netlify/functions/upload-proof.js
// Accepts JSON { orderId, email, method, amount, imageData }
// where imageData is a data URL (base64) from the file input.
// Stores the image in Netlify Blobs under the "proofs" store.

import { getStore } from '@netlify/blobs';

export default async function handler(event) {
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

    // imageData expected like: data:image/png;base64,AAAA...
    let mime = 'image/png';
    let b64 = imageData;
    const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(imageData);
    if (m) {
      mime = m[1];
      b64 = m[2];
    }

    const buffer = Buffer.from(b64, 'base64');

    // Store in Netlify Blobs
    const proofs = getStore('proofs'); // this creates/uses a store called "proofs"
    const ext = mime.split('/')[1] || 'png';
    const key = `${orderId}-${Date.now()}.${ext}`;
    const blob = new Blob([buffer], { type: mime });

    await proofs.set(key, blob);

    // You can later retrieve with: await proofs.get(key, { type: 'blob' })
    // For now we just return the key so you can look it up if needed.
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
}

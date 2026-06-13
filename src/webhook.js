import { set } from '@forge/kvs';
import crypto from '@forge/crypto';
import { requireWebhookSignature } from './lib/resilience/index.js';

// HMAC webhook verification. Set WEBHOOK_SECRET in Forge app storage.
// POST requests must include an X-Webhook-Signature header: hex(sha256(secret + body))
export async function handler(request) {
  if (request.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  try {
    const body = await request.json();
    const rawBody = JSON.stringify(body);

    // HMAC signature verification (fail-closed). A missing WEBHOOK_SECRET now
    // yields 503 rather than silently disabling auth — see requireWebhookSignature.
    const auth = await requireWebhookSignature({
      secret: process.env.WEBHOOK_SECRET,
      signature: request.headers.get('x-webhook-signature'),
      computeExpected: (secret) =>
        crypto.sha256().update(secret + rawBody).digest().then(h => h.toHex()),
    });
    if (!auth.ok) {
      return { status: auth.status, body: { error: auth.reason } };
    }

    if (!body.budget || !body.burnRate || !body.cashForecast || !body.workingCapital) {
      return { status: 400, body: { error: 'Missing required fields: budget, burnRate, cashForecast, workingCapital' } };
    }

    await set('finance-cockpit-data', {
      data: {
        lastUpdated: new Date().toISOString(),
        ...body
      },
      timestamp: Date.now()
    });

    return {
      status: 200,
      body: { success: true, message: 'Finance cockpit data updated' }
    };
  } catch (e) {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }
}

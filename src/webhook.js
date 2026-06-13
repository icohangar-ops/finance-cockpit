import { set } from '@forge/kvs';
import crypto from '@forge/crypto';
import { createWebhookHandler } from './forge-core/index.js';

// HMAC webhook verification. Set WEBHOOK_SECRET in Forge app storage.
// POST requests must include an X-Webhook-Signature header: hex(sha256(secret + body)).
//
// Method check, JSON parse, and fail-closed HMAC verification (missing secret =>
// 503, missing/invalid signature => 401) are all provided by forge-core's
// createWebhookHandler. Only the signature digest, payload validation, and the
// KVS write below are this app's domain-specific pieces.
export const handler = createWebhookHandler({
  computeExpected: ({ secret, rawBody }) =>
    crypto.sha256().update(secret + rawBody).digest().then(h => h.toHex()),
  validate: (body) => {
    if (!body.budget || !body.burnRate || !body.cashForecast || !body.workingCapital) {
      return {
        ok: false,
        status: 400,
        reason: 'Missing required fields: budget, burnRate, cashForecast, workingCapital',
      };
    }
    return { ok: true };
  },
  store: async (body) => {
    await set('finance-cockpit-data', {
      data: {
        lastUpdated: new Date().toISOString(),
        ...body,
      },
      timestamp: Date.now(),
    });
    return { message: 'Finance cockpit data updated' };
  },
});

import { set } from '@forge/kvs';
import crypto from '@forge/crypto';
import { createWebhookHandler } from '../forge-core/index.js';

// This endpoint writes financial data, so auth must fail closed: a missing
// WEBHOOK_SECRET => 503 and a missing/invalid signature => 401, all enforced by
// forge-core's createWebhookHandler (method check + JSON parse + HMAC verify).
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

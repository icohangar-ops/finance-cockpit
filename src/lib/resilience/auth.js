/**
 * Fail-closed auth helpers for Forge webtrigger handlers.
 *
 * Adapted from cubiczan-resilience (typescript/src/auth.ts). The library's
 * `requireAuth` enforces the core invariant we need here: when the expected
 * secret is unset, the check FAILS CLOSED (it never degrades to allowing the
 * request). This module applies that invariant to this app's HMAC webhook
 * scheme instead of bearer tokens.
 *
 * Returns a discriminated result the caller turns into a Forge response:
 *   { ok: true }
 *   { ok: false, status, reason }
 */

/**
 * Resolve the configured webhook secret, failing closed when it is missing.
 *
 * Unlike `process.env.WEBHOOK_SECRET || ''` (which silently disables auth),
 * this returns a 503 result when the secret is absent so a misconfigured
 * deployment refuses requests rather than accepting unauthenticated ones.
 *
 * @param {string|undefined} secret the configured secret (e.g. process.env.WEBHOOK_SECRET)
 * @returns {{ok: true, secret: string} | {ok: false, status: 503, reason: string}}
 */
export function resolveWebhookSecret(secret) {
  const value = typeof secret === 'string' ? secret.trim() : '';
  if (!value) {
    return {
      ok: false,
      status: 503,
      reason: 'Server misconfigured: WEBHOOK_SECRET is not set',
    };
  }
  return { ok: true, secret: value };
}

/**
 * Verify an HMAC-style webhook signature, fail-closed.
 *
 * Mirrors `requireAuth`'s contract: a missing/unset secret => 503 (never
 * allowed); a missing or mismatching signature => 401.
 *
 * @param {Object} params
 * @param {string|undefined} params.secret   configured secret
 * @param {string|null} params.signature     signature header value supplied by the caller
 * @param {() => Promise<string>} params.computeExpected  async fn producing the expected signature
 * @returns {Promise<{ok: true} | {ok: false, status: 401|503, reason: string}>}
 */
export async function requireWebhookSignature({ secret, signature, computeExpected }) {
  const resolved = resolveWebhookSecret(secret);
  if (!resolved.ok) return resolved;

  if (!signature) {
    return { ok: false, status: 401, reason: 'Missing X-Webhook-Signature header' };
  }

  const expected = await computeExpected(resolved.secret);
  if (signature !== expected) {
    return { ok: false, status: 401, reason: 'Invalid webhook signature' };
  }

  return { ok: true };
}

/**
 * Vendored from cubiczan-resilience (typescript/src/timeout.ts), types stripped
 * for the Forge nodejs24.x ESM runtime. Logic is unchanged.
 *
 * Race a promise against a timeout. The original promise keeps running (JS
 * cannot cancel it), but the caller is released after `ms` with a typed
 * {@link ResilienceError} of kind `"timeout"`.
 */
import { ResilienceError } from './errors.js';

export function withTimeout(promise, ms, label = 'operation') {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve(promise);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new ResilienceError('timeout', `${label} timed out after ${ms}ms`, {
          attempts: 1,
        }),
      );
    }, ms);

    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      timer.unref();
    }

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

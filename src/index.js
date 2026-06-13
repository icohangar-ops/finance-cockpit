import { fetch } from '@forge/api';
import { getAll, set } from '@forge/kvs';
import { safeFetch } from './lib/resilience/index.js';
import { createResolver, readCache, writeCache, pick } from './forge-core/index.js';

const PROXY_URL = 'https://db-proxy.example.com/api/finance-cockpit';
const PROXY_TIMEOUT_MS = 8000; // bound proxy latency below the Forge function timeout

const MOCK = {
  budget: { total: 2500000, spent: 1420000, remaining: 1080000, period: 'Q2 2026' },
  burnRate: { monthly: 178000, weekly: 44500, trend: 'stable', runwayMonths: 6 },
  cashForecast: {
    currentBalance: 3200000, minProjected: 1850000, minWeek: 8,
    endPosition: 2750000, riskWeeks: [6, 7, 8], criticalWeeks: [],
    hasCriticalRisk: false, hasWorkingCapitalRisk: true,
  },
  workingCapital: {
    dso: 42, dpo: 58, dio: 31, ccc: 15, status: 'healthy', score: 78,
    recommendations: [
      { action: 'Accelerate AR collection on invoices >60 days', savings: 45000 },
      { action: 'Extend DPO with top 5 vendors by 15 days', savings: 32000 },
    ],
  },
};

const STORAGE_KEY = 'finance-cockpit-data';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch financial data from the CockroachDB REST proxy.
 */
async function getFromProxy() {
  // safeFetch bounds each attempt to PROXY_TIMEOUT_MS (AbortSignal) and retries
  // transient failures with jittered backoff, so a slow proxy falls through to
  // cache/mock within a predictable budget instead of exhausting the Forge
  // function timeout. fetchImpl is Forge's permission-gated fetch.
  const response = await safeFetch(PROXY_URL, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    fetchImpl: fetch,
    timeoutMs: PROXY_TIMEOUT_MS,
    allowlist: ['db-proxy.example.com'],
  });

  if (!response.ok) {
    throw new Error(`Proxy returned ${response.status}`);
  }

  const payload = await response.json();
  const data = {
    lastUpdated: new Date().toISOString(),
    ...payload,
  };

  // Write fresh proxy results back to the cache (only proxy results were ever
  // persisted in the original; cache hits and mock fallbacks are not re-stored).
  await writeCache({ write: (rec) => set(STORAGE_KEY, rec), data });

  return data;
}

/**
 * Main resolver handler — tries proxy → storage(TTL) → mock, in that order.
 * The tiered-fallback chain is provided by forge-core's createResolver/readCache;
 * the proxy fetch, mock, and KVS accessors below are this app's domain-specific
 * pieces.
 */
export const handler = createResolver({
  fromProxy: () => getFromProxy(),
  fromCache: () =>
    readCache({ read: () => getAll(STORAGE_KEY), ttlMs: CACHE_TTL_MS }),
  mock: MOCK,
  decorate: (data, { source, request }) => ({
    ...data,
    projectKey: pick(request, ['context', 'projectKey'], 'UNKNOWN'),
    source,
  }),
});

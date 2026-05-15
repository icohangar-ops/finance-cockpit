import { requestJira, fetch, storage } from '@forge/api';

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
  const response = await fetch('https://db-proxy.example.com/api/finance-cockpit', {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Proxy returned ${response.status}`);
  }

  const payload = await response.json();
  return {
    lastUpdated: new Date().toISOString(),
    ...payload,
  };
}

/**
 * Retrieve cached data from Forge storage if it's still within TTL.
 */
async function getFromStorage() {
  const cached = await storage.get(STORAGE_KEY);
  if (!cached) return null;

  const age = Date.now() - (cached.timestamp || 0);
  if (age > CACHE_TTL_MS) return null;

  return cached.data;
}

/**
 * Persist successful data to Forge storage for future fast access.
 */
async function cacheToStorage(data) {
  await storage.set(STORAGE_KEY, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Main resolver handler — tries proxy → storage → mock, in that order.
 */
export async function handler(request) {
  const projectKey = request.context?.projectKey || 'UNKNOWN';

  // 1. Try CockroachDB REST proxy
  try {
    const proxyData = await getFromProxy();
    await cacheToStorage(proxyData);
    return { ...proxyData, projectKey, source: 'proxy' };
  } catch (proxyErr) {
    console.warn('CockroachDB proxy unavailable:', proxyErr.message);
  }

  // 2. Try Forge storage cache
  try {
    const cachedData = await getFromStorage();
    if (cachedData) {
      return { ...cachedData, projectKey, source: 'cache' };
    }
  } catch (storageErr) {
    console.warn('Storage read failed:', storageErr.message);
  }

  // 3. Fallback to mock data
  return { ...MOCK, projectKey, source: 'mock' };
}

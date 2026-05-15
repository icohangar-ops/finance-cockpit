import { set } from '@forge/kvs';

export async function handler(request) {
  if (request.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  try {
    const body = await request.json();
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

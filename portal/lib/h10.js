// Whether the actor has a saved Helium 10 session (storageState) in its named
// key-value store. Used to show login status on the dashboard. The actor saves
// it after a successful Live View login and reuses it on every run.
export async function h10SessionStatus() {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { connected: false, reason: 'no-token' };
  try {
    const storesRes = await fetch(`https://api.apify.com/v2/key-value-stores?token=${token}&limit=1000`);
    if (!storesRes.ok) return { connected: false, reason: 'api-error' };
    const stores = (await storesRes.json())?.data?.items ?? [];
    const store = stores.find((s) => s.name === 'h10-session');
    if (!store) return { connected: false, reason: 'no-store' };
    const keysRes = await fetch(`https://api.apify.com/v2/key-value-stores/${store.id}/keys?token=${token}`);
    const keys = (await keysRes.json())?.data?.items ?? [];
    const connected = keys.some((k) => k.key === 'storageState');
    return { connected, savedAt: store.modifiedAt ?? null, reason: connected ? 'ok' : 'no-session' };
  } catch {
    return { connected: false, reason: 'error' };
  }
}

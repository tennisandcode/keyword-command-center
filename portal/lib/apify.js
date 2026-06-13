// Trigger and inspect actor runs via the Apify API.
const BASE = 'https://api.apify.com/v2';
const ACTOR = process.env.APIFY_ACTOR_ID; // e.g. "username~h10-keyword-finder"
const TOKEN = process.env.APIFY_TOKEN;

export async function startRun(asins = []) {
  const res = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${TOKEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ asins }),
  });
  if (!res.ok) throw new Error(`Apify start failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return {
    runId: data.id,
    status: data.status,
    // Live View for the attended login handoff: the "Live view" tab of the run.
    liveViewUrl: `https://console.apify.com/actors/runs/${data.id}#liveView`,
    consoleUrl: `https://console.apify.com/actors/runs/${data.id}`,
  };
}

export async function runStatus(runId) {
  const res = await fetch(`${BASE}/actor-runs/${runId}?token=${TOKEN}`);
  const { data } = await res.json();
  return { status: data.status, statusMessage: data.statusMessage };
}

import { startRun } from '../../../../lib/apify';
import { requireToken } from '../../../../lib/auth';

// POST { asins?: string[] } → kicks the Apify actor; returns liveViewUrl so the
// UI can show "If login is required, open Live View and sign in".
export async function POST(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { asins = [] } = await req.json().catch(() => ({}));
  const run = await startRun(asins);
  return Response.json(run);
}

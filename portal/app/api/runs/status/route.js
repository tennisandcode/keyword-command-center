import { runStatus } from '../../../../lib/apify';
import { requireToken } from '../../../../lib/auth';

// GET /api/runs/status?runId=... — live Apify run status for the dashboard bar.
export async function GET(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  if (!runId) return Response.json({ error: 'runId required' }, { status: 400 });
  try {
    const s = await runStatus(runId);
    return Response.json(s);
  } catch (e) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}

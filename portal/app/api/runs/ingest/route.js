import { requireToken } from '../../../../lib/auth';

// Webhook target the actor calls when a run finishes. The actor already wrote
// rows directly to Postgres; this endpoint is the hook for notifications.
export async function POST(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.runStartedAt !== 'string' || !Array.isArray(body.summary)) {
    return Response.json({ error: 'Expected { runStartedAt: string, summary: [] }' }, { status: 400 });
  }
  const { runStartedAt, summary } = body;

  // Optional email digest via Resend.
  if (process.env.RESEND_API_KEY && process.env.DIGEST_EMAIL) {
    const lines = summary.map(
      (s) => `${s.asin}: ${s.newKeywords} new keywords (${(s.highOpportunity ?? []).join(', ') || 'no high-opportunity finds'})`
    );
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Keyword Command Center <onboarding@resend.dev>',
        to: [process.env.DIGEST_EMAIL],
        subject: `Keyword run ${runStartedAt.slice(0, 10)}: ${summary.reduce((n, s) => n + s.newKeywords, 0)} new keywords`,
        text: lines.join('\n'),
      }),
    });
  }
  return Response.json({ ok: true });
}

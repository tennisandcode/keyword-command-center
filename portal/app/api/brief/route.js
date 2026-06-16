import { requireToken } from '../../../lib/auth';
import { streamText } from '../../../lib/claude';
import { gatherData, dataToText } from '../../../lib/kccData';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM = `You are a senior Amazon PPC and SEO strategist. You analyze a seller's weekly keyword scan (Helium 10 Cerebro data: search volume, the seller's own organic rank, week-over-week rank movement, and top competitor listings) and produce a tight, decisive weekly action brief for the seller's media buyer.

Rules:
- Be specific and quantitative. Cite keyword names, volumes, ranks, deltas, and competitor ASINs.
- No fluff, no hedging, no generic advice. Prioritize ruthlessly.
- weekly_delta is positive when the seller's rank IMPROVED (moved toward #1). "new" means first seen this run.`;

const INSTRUCTION = `Write this week's Intelligence Brief in markdown, under ~500 words, with exactly these sections:

**TL;DR** — 2-3 sentences on the single most important thing this week.
**Top 3 moves** — the 3 highest-leverage actions, each with the keyword, the why (cite numbers), and the expected impact.
**Push to page 1** — high-volume keywords ranking ~#11-#40 where a focused push is worth it.
**Movers** — notable rank improvements and declines this run.
**Competitors to attack** — 2-3 competitor listings with a specific exploitable weakness (few reviews, low rating, weak/short title) and which keyword to attack them on.
**Listing + PPC tweaks** — concrete title/backend-keyword additions and 2-3 PPC keywords to bid on.

Be decisive — recommend, don't survey.`;

export async function POST(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const data = await gatherData();
  if (!data.keywords.length) {
    return new Response('No scan data yet — run a scan first, then generate a brief.', { status: 200 });
  }
  const block = dataToText(data);
  const body = streamText({
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: `${block}\n\n---\n\n${INSTRUCTION}` }] }],
    maxTokens: 6000,
  });
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

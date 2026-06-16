import { prisma } from '../../../lib/db';
import { requireToken } from '../../../lib/auth';
import { streamText } from '../../../lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM = `You are an Amazon competitive analyst. Given a competitor's listing data and the seller's keyword context, produce a sharp teardown: the competitor's specific, exploitable weaknesses (low review count, weak rating, short/keyword-poor title, high price) and exactly how the seller can take share — which keywords to target and what listing/PPC moves to make. Be specific and quantitative; cite the competitor's numbers and the relevant keyword volumes/ranks. No generic advice.`;

async function latestRun() {
  return prisma.run.findFirst({ orderBy: { startedAt: 'desc' } });
}

// GET — list the competitors seen in the latest run, for the picker.
export async function GET(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const run = await latestRun();
  if (!run) return Response.json({ competitors: [] });
  const rows = await prisma.competitor.findMany({ where: { runId: run.id } });
  const byAsin = new Map();
  for (const r of rows) {
    const e = byAsin.get(r.asin) ?? { asin: r.asin, title: r.title, keywords: new Set(), rating: r.rating, reviewCount: r.reviewCount, price: r.price };
    e.keywords.add(r.keyword);
    byAsin.set(r.asin, e);
  }
  const competitors = [...byAsin.values()]
    .map((e) => ({ asin: e.asin, title: e.title, rating: e.rating, reviewCount: e.reviewCount, price: e.price, keywordCount: e.keywords.size }))
    .sort((a, b) => b.keywordCount - a.keywordCount);
  return Response.json({ competitors });
}

// POST { asin } — stream the teardown for one competitor.
export async function POST(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { asin } = await req.json().catch(() => ({}));
  if (!asin) return new Response('asin required', { status: 400 });

  const run = await latestRun();
  if (!run) return new Response('No scan data yet.', { status: 200 });
  const rows = await prisma.competitor.findMany({ where: { runId: run.id, asin }, orderBy: { position: 'asc' } });
  if (!rows.length) return new Response('Competitor not found in the latest run.', { status: 200 });

  const keywords = [...new Set(rows.map((r) => r.keyword))];
  const sellerKw = await prisma.keyword.findMany({
    where: { keyword: { in: keywords } },
    include: { snapshots: { orderBy: { id: 'desc' }, take: 1 } },
  });

  const lines = [];
  lines.push(`# Competitor teardown target: ${asin}`);
  lines.push(`Title: ${rows[0].title}`);
  lines.push(`Price: ${rows[0].price ?? '-'} | Rating: ${rows[0].rating ?? '-'} | Reviews: ${rows[0].reviewCount ?? '-'}`);
  lines.push('');
  lines.push(`## Keywords this competitor ranks for (vs the seller)`);
  lines.push('keyword | competitor_serp_rank | seller_organic_rank | seller_search_volume');
  for (const r of rows) {
    const sk = sellerKw.find((k) => k.keyword === r.keyword);
    const snap = sk?.snapshots?.[0];
    lines.push(`${r.keyword} | ${r.position} | ${snap?.organicRank ?? '-'} | ${snap?.searchVolume ?? '-'}`);
  }
  lines.push('');
  lines.push(`Produce the teardown now: weaknesses, where they are vulnerable, and the seller's specific plan to take share (keywords to target + listing/PPC moves).`);

  const body = streamText({
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: lines.join('\n') }] }],
    maxTokens: 2500,
  });
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

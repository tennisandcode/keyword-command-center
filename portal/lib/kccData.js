import { prisma } from './db';

// Pull the current keyword + competitor + rank-movement picture from Postgres.
// Deterministic ordering so the serialized block is byte-stable → prompt cache hits.
export async function gatherData() {
  const [keywords, latestRun] = await Promise.all([
    prisma.keyword.findMany({
      include: { snapshots: { orderBy: { id: 'desc' }, take: 2, include: { run: true } } },
      orderBy: { keyword: 'asc' },
    }),
    prisma.run.findFirst({ orderBy: { startedAt: 'desc' } }),
  ]);
  const competitors = latestRun
    ? await prisma.competitor.findMany({
        where: { runId: latestRun.id },
        orderBy: [{ keyword: 'asc' }, { position: 'asc' }],
      })
    : [];

  const kw = keywords
    .map((k) => {
      const [cur, prev] = k.snapshots;
      return {
        keyword: k.keyword,
        asin: k.asin,
        cls: k.classification,
        status: k.status,
        rank: cur?.organicRank ?? null,
        delta: cur && prev ? prev.organicRank - cur.organicRank : null, // + = improved
        volume: cur?.searchVolume ?? null,
        iq: cur?.cerebroIq ?? null,
        titleDensity: cur?.titleDensity ?? null,
      };
    })
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

  return { keywords: kw, competitors, runDate: latestRun?.startedAt ?? null };
}

// Serialize into a compact, LLM-friendly text block.
export function dataToText({ keywords, competitors, runDate }) {
  const lines = [];
  lines.push(`# Amazon keyword scan data`);
  lines.push(`Most recent run: ${runDate ? new Date(runDate).toISOString().slice(0, 10) : 'n/a'}`);
  lines.push(`Keyword count: ${keywords.length} | Competitor rows: ${competitors.length}`);
  lines.push('');
  lines.push(`## KEYWORDS (sorted by search volume; weekly_delta + = rank improved, "new" = first seen)`);
  lines.push('keyword | search_volume | organic_rank | weekly_delta | class | status | title_density');
  for (const k of keywords) {
    lines.push(
      `${k.keyword} | ${k.volume ?? '-'} | ${k.rank ?? '-'} | ${k.delta ?? 'new'} | ${k.cls} | ${k.status} | ${k.titleDensity ?? '-'}`
    );
  }
  lines.push('');
  lines.push(`## COMPETITORS (top organic listings per analyzed keyword)`);
  lines.push('keyword | serp_rank | competitor_asin | title | price | rating | review_count');
  for (const c of competitors) {
    lines.push(
      `${c.keyword} | ${c.position} | ${c.asin} | ${c.title} | ${c.price ?? '-'} | ${c.rating ?? '-'} | ${c.reviewCount ?? '-'}`
    );
  }
  return lines.join('\n');
}

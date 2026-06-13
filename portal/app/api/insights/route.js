import { prisma } from '../../../lib/db';
import { requireToken } from '../../../lib/auth';

// GET /api/insights?asin=B0DDQL7PVM — rank trajectories + open work, the data
// behind the weekly dashboard. The actor computes scores; this serves history.
export async function GET(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { searchParams } = new URL(req.url);
  const asin = searchParams.get('asin');

  const keywords = await prisma.keyword.findMany({
    where: asin ? { asin } : {},
    include: {
      snapshots: { orderBy: { id: 'asc' }, include: { run: true } },
      todos: { where: { done: false } },
    },
  });

  const insights = keywords.map((k) => {
    const ranks = k.snapshots.map((s) => ({
      date: s.run.startedAt, rank: s.organicRank, volume: s.searchVolume,
    }));
    const current = ranks.at(-1);
    const prev = ranks.at(-2);
    return {
      keyword: k.keyword,
      asin: k.asin,
      classification: k.classification,
      status: k.status,
      currentRank: current?.rank ?? null,
      weeklyDelta: current && prev ? prev.rank - current.rank : null,
      volume: current?.volume ?? null,
      history: ranks,
      openTodos: k.todos.length,
    };
  });

  return Response.json({
    generatedAt: new Date().toISOString(),
    count: insights.length,
    improving: insights.filter((i) => (i.weeklyDelta ?? 0) > 0).length,
    declining: insights.filter((i) => (i.weeklyDelta ?? 0) < 0).length,
    insights: insights.sort((a, b) => (b.weeklyDelta ?? -99) - (a.weeklyDelta ?? -99)),
  });
}

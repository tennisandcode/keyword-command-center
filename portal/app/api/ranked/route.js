import { prisma } from '../../../lib/db';
import { requireToken } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/ranked — every keyword the ASIN ranks for (top 100, or top 150 if vol>=3000).
export async function GET(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const rows = await prisma.rankedKeyword.findMany({ orderBy: { organicRank: 'asc' } }).catch(() => []);
  return Response.json({
    count: rows.length,
    capturedAt: rows[0]?.capturedAt ?? null,
    keywords: rows.map((r) => ({
      asin: r.asin,
      keyword: r.keyword,
      organicRank: r.organicRank,
      searchVolume: r.searchVolume,
      cerebroIq: r.cerebroIq,
      titleDensity: r.titleDensity,
      competing: r.competing,
    })),
  });
}

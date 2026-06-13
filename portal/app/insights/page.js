import { prisma } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const keywords = await prisma.keyword.findMany({
    include: { snapshots: { orderBy: { id: 'asc' }, include: { run: true } } },
  });

  const rows = keywords.map((k) => {
    const ranks = k.snapshots.map((s) => s.organicRank);
    const current = ranks.at(-1);
    const prev = ranks.at(-2);
    const oldest = ranks[0];
    return {
      keyword: k.keyword,
      asin: k.asin,
      current,
      weekly: prev != null && current != null ? prev - current : null,
      total: oldest != null && current != null ? oldest - current : null,
      runs: ranks.length,
      classification: k.classification,
    };
  }).sort((a, b) => (b.weekly ?? -99) - (a.weekly ?? -99));

  return (
    <>
      <h2 style={{ fontSize: 18 }}>Insights — rank movement</h2>
      <p style={{ fontSize: 13, color: '#666' }}>
        Compares organic rank week-over-week. ▲ = improving, ▼ = losing position. The v2 actor scores opportunity 0–100 per keyword and emits the weekly markdown report you can read in the vault.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e0' }}>
            <th style={{ padding: 8 }}>Keyword</th><th>ASIN</th><th>Rank</th>
            <th>WoW Δ</th><th>Total Δ</th><th>Runs</th><th>Class</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.asin}-${r.keyword}`} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{r.keyword}</td>
              <td style={{ fontFamily: 'monospace' }}>{r.asin}</td>
              <td>{r.current != null ? `#${r.current}` : '—'}</td>
              <td style={{ color: r.weekly > 0 ? 'green' : r.weekly < 0 ? 'crimson' : '#888' }}>
                {r.weekly == null ? 'new' : r.weekly > 0 ? `▲ ${r.weekly}` : r.weekly < 0 ? `▼ ${-r.weekly}` : '–'}
              </td>
              <td>{r.total ?? '—'}</td>
              <td>{r.runs}</td>
              <td>{r.classification}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

import { prisma } from '../lib/db';
import RunButton from '../components/RunButton';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [products, openTodos, highOpp, latestRun] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.todo.count({ where: { done: false } }),
    prisma.keyword.findMany({
      where: { classification: 'high_opportunity' },
      include: { snapshots: { orderBy: { id: 'desc' }, take: 2 } },
      take: 20,
    }),
    prisma.run.findFirst({ orderBy: { startedAt: 'desc' } }),
  ]);

  return (
    <>
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        <Stat label="Active products" value={products} />
        <Stat label="Open to-dos" value={openTodos} />
        <Stat label="High-opportunity keywords" value={highOpp.length} />
        <Stat label="Last run" value={latestRun ? latestRun.startedAt.toISOString().slice(0, 10) : '—'} />
        <RunButton />
      </div>

      <h2 style={{ fontSize: 18 }}>High-opportunity keywords — weekly movement</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e0' }}>
            <th style={{ padding: 8 }}>Keyword</th><th>ASIN</th><th>Volume</th>
            <th>Rank</th><th>Δ vs prior</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {highOpp.map((k) => {
            const [cur, prev] = k.snapshots;
            const delta = cur && prev ? prev.organicRank - cur.organicRank : null;
            return (
              <tr key={k.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{k.keyword}</td>
                <td>{k.asin}</td>
                <td>{cur?.searchVolume?.toLocaleString() ?? '—'}</td>
                <td>#{cur?.organicRank ?? '—'}</td>
                <td style={{ color: delta > 0 ? 'green' : delta < 0 ? 'crimson' : '#888' }}>
                  {delta === null ? 'new' : delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : '–'}
                </td>
                <td>{k.status}</td>
              </tr>
            );
          })}
          {highOpp.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 16, color: '#888' }}>
                No high-opportunity keywords yet. Click <strong>▶ Run all products now</strong> (add products first on the Products tab) to populate this.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 8, padding: '12px 20px' }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}

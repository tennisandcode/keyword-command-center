import { prisma } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const runs = await prisma.run.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { _count: { select: { snapshots: true, competitors: true } } },
  });
  return (
    <>
      <h2 style={{ fontSize: 18 }}>Run history</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e0' }}>
            <th style={{ padding: 8 }}>Date</th><th>ASIN</th><th>Keyword snapshots</th><th>Competitor rows</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{r.startedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
              <td style={{ fontFamily: 'monospace' }}>{r.asin}</td>
              <td>{r._count.snapshots}</td>
              <td>{r._count.competitors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

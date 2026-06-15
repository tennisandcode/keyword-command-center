import { prisma } from '../lib/db';
import RunButton from '../components/RunButton';
import ClearDataButton from '../components/ClearDataButton';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [productList, runs] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: { asin: true, title: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.run.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { _count: { select: { snapshots: true, competitors: true } } },
    }),
  ]);

  const sheetId = process.env.SHEET_ID;
  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {sheetUrl ? (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 20px', background: '#0a7f3f', color: '#fff',
              borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}
          >
            📊 Open Google Sheet
          </a>
        ) : (
          <span style={{ fontSize: 13, color: '#999' }}>Set <code>SHEET_ID</code> to show the Google Sheet link.</span>
        )}
        <RunButton products={productList} />
        <span style={{ marginLeft: 'auto' }}><ClearDataButton /></span>
      </div>

      <h2 style={{ fontSize: 18 }}>Run history</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e0' }}>
            <th style={{ padding: 8 }}>Date</th><th>ASIN</th><th>Keywords</th><th>Competitors</th><th>Sheet</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const rowUrl = sheetUrl ? `${sheetUrl}?run=${r.startedAt.toISOString().slice(0, 10)}#gid=0` : null;
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{r.startedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.asin}</td>
                <td>{r._count.snapshots}</td>
                <td>{r._count.competitors}</td>
                <td>{rowUrl ? <a href={rowUrl} target="_blank" rel="noreferrer">📊 Open</a> : <span style={{ color: '#aaa' }}>—</span>}</td>
              </tr>
            );
          })}
          {runs.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 16, color: '#888' }}>
                No runs yet — click <strong>▶ Run all products now</strong> (add products on the Products tab first).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

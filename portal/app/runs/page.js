import { prisma } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const runs = await prisma.run.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { _count: { select: { snapshots: true, competitors: true } } },
  });
  // Google Sheet that the actor/sync writes to (set SHEET_ID on the service).
  const sheetId = process.env.SHEET_ID;
  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null;

  return (
    <>
      <h2 style={{ fontSize: 18 }}>Run history</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e0' }}>
            <th style={{ padding: 8 }}>Date</th><th>ASIN</th><th>Keyword snapshots</th><th>Competitor rows</th><th>Sheet</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            // Deep-link to that run's date in the sheet's search params (operator can filter by it).
            const rowUrl = sheetUrl
              ? `${sheetUrl}?run=${r.startedAt.toISOString().slice(0, 10)}#gid=0`
              : null;
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{r.startedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.asin}</td>
                <td>{r._count.snapshots}</td>
                <td>{r._count.competitors}</td>
                <td>
                  {rowUrl
                    ? <a href={rowUrl} target="_blank" rel="noreferrer">📊 Open</a>
                    : <span style={{ color: '#aaa' }}>—</span>}
                </td>
              </tr>
            );
          })}
          {runs.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 16, color: '#888' }}>
                No runs yet. Start one from the Dashboard with <strong>▶ Run all products now</strong>.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!sheetUrl && (
        <p style={{ fontSize: 12, color: '#999', marginTop: 10 }}>
          Set <code>SHEET_ID</code> on the service to enable the Google Sheet links.
        </p>
      )}
    </>
  );
}

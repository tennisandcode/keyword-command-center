import { prisma } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: { _count: { select: { keywords: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return (
    <>
      <h2 style={{ fontSize: 18 }}>Products</h2>
      <p style={{ fontSize: 13, color: '#666' }}>
        Add products via POST /api/products {'{ asin, title }'} — or ask Claude to add them.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e0' }}>
            <th style={{ padding: 8 }}>ASIN</th><th>Title</th><th>Keywords tracked</th><th>Active</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.asin} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, fontFamily: 'monospace' }}>{p.asin}</td>
              <td>{p.title ?? '—'}</td>
              <td>{p._count.keywords}</td>
              <td>{p.active ? '✓' : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

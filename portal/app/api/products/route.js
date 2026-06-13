import { prisma } from '../../../lib/db';
import { requireToken } from '../../../lib/auth';

export async function GET(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { searchParams } = new URL(req.url);
  const where = searchParams.get('active') ? { active: true } : {};
  const products = await prisma.product.findMany({ where, orderBy: { createdAt: 'asc' } });
  return Response.json(products);
}

export async function POST(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { asin, title } = await req.json();
  if (!/^B0[A-Z0-9]{8}$/.test(asin ?? '')) {
    return Response.json({ error: 'Invalid ASIN format' }, { status: 400 });
  }
  const product = await prisma.product.upsert({
    where: { asin },
    update: { title, active: true },
    create: { asin, title },
  });
  return Response.json(product);
}

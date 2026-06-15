import { prisma } from '../../../lib/db';
import { requireToken } from '../../../lib/auth';

// DELETE /api/data — wipe all scan data (keeps Products so ASINs stay).
// Order matters for FK constraints: snapshots/competitors/todos → keywords → runs.
export async function DELETE(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  await prisma.keywordSnapshot.deleteMany({});
  await prisma.competitor.deleteMany({});
  await prisma.todo.deleteMany({});
  await prisma.keyword.deleteMany({});
  await prisma.run.deleteMany({});
  return Response.json({ ok: true });
}

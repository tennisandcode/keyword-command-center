import { prisma } from '../../../../lib/db';
import { requireToken } from '../../../../lib/auth';

// PATCH { done: boolean } — the checkbox.
export async function PATCH(req, { params }) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { done } = await req.json();
  const todo = await prisma.todo.update({
    where: { id: Number(params.id) },
    data: { done: Boolean(done) },
  });
  return Response.json(todo);
}

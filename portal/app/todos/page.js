import { prisma } from '../../lib/db';
import TodoList from '../../components/TodoList';

export const dynamic = 'force-dynamic';

export default async function TodosPage() {
  const todos = await prisma.todo.findMany({
    include: { keyword: true },
    orderBy: [{ done: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
  });
  return (
    <>
      <h2 style={{ fontSize: 18 }}>Ranking to-dos</h2>
      <TodoList
        initial={todos.map((t) => ({
          id: t.id,
          keyword: t.keyword.keyword,
          asin: t.keyword.asin,
          action: t.action,
          priority: t.priority,
          done: t.done,
        }))}
      />
    </>
  );
}

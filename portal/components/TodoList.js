'use client';
import { useState } from 'react';

export default function TodoList({ initial }) {
  const [todos, setTodos] = useState(initial);

  async function toggle(id, done) {
    setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, done } : t)));
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.NEXT_PUBLIC_PORTAL_API_TOKEN ?? ''}`,
      },
      body: JSON.stringify({ done }),
    });
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {todos.map((t) => (
        <li
          key={t.id}
          style={{
            display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px',
            background: '#fff', border: '1px solid #e5e5e0', borderRadius: 8, marginBottom: 8,
            opacity: t.done ? 0.5 : 1,
          }}
        >
          <input type="checkbox" checked={t.done} onChange={(e) => toggle(t.id, e.target.checked)} />
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 99,
            background: t.priority === 'high' ? '#fde8e8' : '#eef2f7',
            color: t.priority === 'high' ? '#b91c1c' : '#475569',
          }}>
            {t.priority}
          </span>
          <strong>{t.keyword}</strong>
          <span style={{ color: '#666', fontSize: 13 }}>{t.action}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>{t.asin}</span>
        </li>
      ))}
    </ul>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Inline form to add a product (ASIN + optional title) without curl/Claude.
export default function AddProduct() {
  const router = useRouter();
  const [asin, setAsin] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.NEXT_PUBLIC_PORTAL_API_TOKEN ?? ''}`,
        },
        body: JSON.stringify({ asin: asin.trim().toUpperCase(), title: title.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
        return;
      }
      setAsin('');
      setTitle('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 20px' }}>
      <input
        value={asin}
        onChange={(e) => setAsin(e.target.value)}
        placeholder="ASIN (e.g. B0DDQL7PVM)"
        style={{ padding: '8px 10px', border: '1px solid #d4d4cf', borderRadius: 6, fontFamily: 'monospace', width: 200 }}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        style={{ padding: '8px 10px', border: '1px solid #d4d4cf', borderRadius: 6, flex: 1, minWidth: 160 }}
      />
      <button
        type="submit"
        disabled={busy || !asin.trim()}
        style={{ padding: '8px 18px', background: '#1a1a1a', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 14, opacity: busy || !asin.trim() ? 0.5 : 1 }}
      >
        {busy ? 'Adding…' : 'Add product'}
      </button>
      {error && <span style={{ color: 'crimson', fontSize: 13 }}>{error}</span>}
    </form>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Wipes all scan data (runs, keywords, snapshots, competitors, to-dos). Keeps products.
export default function ClearDataButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clear() {
    if (!confirm('Erase ALL scan data — runs, keywords, snapshots, competitors, to-dos?\n\nYour products (ASINs) are kept. This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/data', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_PORTAL_API_TOKEN ?? ''}` },
      });
      if (!res.ok) alert(`Failed to erase (${res.status})`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={clear}
      disabled={busy}
      title="Erase all scan data (keeps products)"
      style={{
        padding: '10px 16px', background: '#fff', color: '#b42318',
        border: '1px solid #fda29b', borderRadius: 8, cursor: 'pointer', fontSize: 14,
      }}
    >
      {busy ? 'Erasing…' : '🗑 Erase data'}
    </button>
  );
}

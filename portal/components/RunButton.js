'use client';
import { useState } from 'react';

// Kicks the actor and surfaces the Live View link for the login handoff.
export default function RunButton() {
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch('/api/runs/start', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.NEXT_PUBLIC_PORTAL_API_TOKEN ?? ''}`,
        },
        body: JSON.stringify({}),
      });
      setRun(await res.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
      <button
        onClick={start}
        disabled={busy}
        style={{ padding: '10px 22px', background: '#1a1a1a', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
      >
        {busy ? 'Starting…' : '▶ Run all products now'}
      </button>
      {run && (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Run started.{' '}
          <a href={run.liveViewUrl} target="_blank" rel="noreferrer">
            Open Live View
          </a>{' '}
          (sign in there if Helium 10 asks).
        </div>
      )}
    </div>
  );
}

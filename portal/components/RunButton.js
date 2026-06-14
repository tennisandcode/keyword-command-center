'use client';
import { useState, useEffect, useRef } from 'react';

const TERMINAL = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'];

const LABELS = {
  READY: 'Queued…',
  RUNNING: 'Running…',
  SUCCEEDED: 'Done ✓',
  FAILED: 'Failed',
  ABORTED: 'Aborted',
  'TIMED-OUT': 'Timed out',
};

// Kicks the actor (all products or one) and shows a live status bar above the
// Live View link for the login handoff.
export default function RunButton({ products = [] }) {
  const [run, setRun] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const pollRef = useRef(null);

  const token = process.env.NEXT_PUBLIC_PORTAL_API_TOKEN ?? '';

  async function start(asins) {
    setBusy(true);
    setStatus(null);
    setRun(null);
    try {
      const res = await fetch('/api/runs/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ asins }),
      });
      const data = await res.json();
      setRun(data);
      setStatus(data.status || 'READY');
    } finally {
      setBusy(false);
    }
  }

  // Poll the run status until it reaches a terminal state.
  useEffect(() => {
    if (!run?.runId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/status?runId=${run.runId}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const s = await res.json();
        if (s.status) setStatus(s.status);
        if (TERMINAL.includes(s.status)) clearInterval(pollRef.current);
      } catch {
        /* transient — keep polling */
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [run?.runId, token]);

  const running = status === 'READY' || status === 'RUNNING';
  const pct = status == null ? 0 : status === 'READY' ? 15 : status === 'RUNNING' ? 65 : 100;
  const cls = running ? 'running' : status === 'SUCCEEDED' ? 'done' : 'failed';

  const btn = {
    padding: '10px 18px', background: '#1a1a1a', color: '#fff', border: 0,
    borderRadius: 8, cursor: 'pointer', fontSize: 14,
  };
  const disabledBtn = { ...btn, opacity: 0.5, cursor: 'not-allowed' };

  return (
    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        {products.length > 0 && (
          <>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{ padding: '9px 10px', border: '1px solid #d4d4cf', borderRadius: 8, fontSize: 13, maxWidth: 220 }}
            >
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.asin} value={p.asin}>{p.title ? `${p.title} (${p.asin})` : p.asin}</option>
              ))}
            </select>
            <button onClick={() => start([selected])} disabled={busy || !selected} style={busy || !selected ? disabledBtn : btn}>
              ▶ Run 1
            </button>
          </>
        )}
        <button onClick={() => start([])} disabled={busy} style={busy ? disabledBtn : btn}>
          {busy ? 'Starting…' : '▶ Run all products now'}
        </button>
      </div>

      {run && (
        <div style={{ marginTop: 10, minWidth: 260 }}>
          <div className="kcc-bar">
            <div className={`kcc-fill ${cls}`} style={{ width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: 12, marginTop: 5 }}>
            <strong>{LABELS[status] ?? status ?? 'Run started'}</strong>{' · '}
            <a href={run.liveViewUrl} target="_blank" rel="noreferrer">Open Live View</a>
            {' '}(sign in there if Helium 10 asks).
          </div>
          <style jsx>{`
            .kcc-bar { height: 6px; background: #ececea; border-radius: 99px; overflow: hidden; }
            .kcc-fill { height: 100%; border-radius: 99px; transition: width 0.4s ease; }
            .running { background: linear-gradient(90deg, #1a1a1a, #9a9a9a, #1a1a1a); background-size: 200% 100%; animation: kccShimmer 1.2s linear infinite; }
            .done { background: #16a34a; }
            .failed { background: crimson; }
            @keyframes kccShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
          `}</style>
        </div>
      )}
    </div>
  );
}

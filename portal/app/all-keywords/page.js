'use client';
import { useState, useEffect, useMemo } from 'react';

const TOKEN = process.env.NEXT_PUBLIC_PORTAL_API_TOKEN ?? '';
const auth = { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` };

const COLS = [
  { key: 'keyword', label: 'Keyword', num: false },
  { key: 'organicRank', label: 'Organic Rank', num: true },
  { key: 'searchVolume', label: 'Search Volume', num: true },
  { key: 'cerebroIq', label: 'Cerebro IQ', num: true },
  { key: 'titleDensity', label: 'Title Density', num: true },
  { key: 'competing', label: 'Competing', num: false },
];

function applyFilters(rows, filters) {
  if (!filters?.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => {
      if (f.op === 'contains') return String(r.keyword).toLowerCase().includes(String(f.value).toLowerCase());
      const n = Number(r[f.column]);
      const v = Number(String(f.value).replace(/[^0-9.\-]/g, ''));
      if (!Number.isFinite(n) || !Number.isFinite(v)) return true;
      if (f.op === 'lte') return n <= v;
      if (f.op === 'gte') return n >= v;
      if (f.op === 'eq') return n === v;
      return true;
    })
  );
}
function sortRows(rows, by, dir) {
  const out = [...rows].sort((a, b) => {
    if (by === 'keyword') return String(a.keyword).localeCompare(String(b.keyword));
    return (Number(a[by]) || 0) - (Number(b[by]) || 0);
  });
  return dir === 'desc' ? out.reverse() : out;
}

export default function AllKeywords() {
  const [rows, setRows] = useState(null);
  const [text, setText] = useState('');
  const [sortBy, setSortBy] = useState('organicRank');
  const [sortDir, setSortDir] = useState('asc');
  const [aiFilters, setAiFilters] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');

  useEffect(() => {
    fetch('/api/ranked', { headers: auth })
      .then((r) => (r.ok ? r.json() : { keywords: [] }))
      .then((d) => setRows(d.keywords || []))
      .catch(() => setRows([]));
  }, []);

  const view = useMemo(() => {
    if (!rows) return [];
    let v = rows;
    if (text.trim()) v = v.filter((r) => String(r.keyword).toLowerCase().includes(text.trim().toLowerCase()));
    v = applyFilters(v, aiFilters);
    return sortRows(v, sortBy, sortDir);
  }, [rows, text, aiFilters, sortBy, sortDir]);

  function clickHeader(key) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir(key === 'keyword' ? 'asc' : key === 'organicRank' ? 'asc' : 'desc'); }
  }

  async function askAi() {
    const q = aiInput.trim();
    if (!q || aiBusy) return;
    setAiBusy(true); setAiNote('');
    try {
      const res = await fetch('/api/ranked-sort', { method: 'POST', headers: auth, body: JSON.stringify({ request: q }) });
      const spec = await res.json();
      if (!res.ok || spec.error) { setAiNote(`AI error: ${spec.error || res.status}`); return; }
      setSortBy(spec.sortBy); setSortDir(spec.sortDir); setAiFilters(spec.filters || []);
      setAiNote(spec.explanation || 'Applied.');
    } finally { setAiBusy(false); }
  }

  return (
    <>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>All Ranked Keywords</h2>
      <p style={{ fontSize: 13, color: '#666', marginTop: 0 }}>
        Every keyword you rank for — top 100 placements, plus high-volume (≥3,000/mo) keywords up to rank #150. Pulled weekly.
      </p>

      {/* AI sort/filter */}
      <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 14, margin: '12px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#5b21b6', marginBottom: 6 }}>🧠 Sort / filter with AI</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAi()}
            placeholder='e.g. "high-volume keywords I rank #11–30 for, sorted by volume"'
            style={{ flex: 1, padding: '9px 12px', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 14 }}
          />
          <button onClick={askAi} disabled={aiBusy} style={{ padding: '9px 16px', background: '#5b21b6', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: aiBusy ? 0.5 : 1 }}>
            {aiBusy ? 'Thinking…' : 'Apply'}
          </button>
          {aiFilters.length > 0 && (
            <button onClick={() => { setAiFilters([]); setAiNote(''); }} style={{ padding: '9px 12px', background: '#fff', color: '#5b21b6', border: '1px solid #c4b5fd', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Clear</button>
          )}
        </div>
        {aiNote && <div style={{ fontSize: 12, color: '#6d28d9', marginTop: 6 }}>{aiNote}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search keywords…" style={{ padding: '7px 10px', border: '1px solid #d4d4cf', borderRadius: 8, fontSize: 13, width: 220 }} />
        <span style={{ fontSize: 13, color: '#888' }}>{rows == null ? 'Loading…' : `${view.length} of ${rows.length} keywords`}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e0' }}>
              {COLS.map((c) => (
                <th key={c.key} onClick={() => clickHeader(c.key)} style={{ padding: 8, cursor: 'pointer', userSelect: 'none', textAlign: c.num ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                  {c.label}{sortBy === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{r.keyword}</td>
                <td style={{ textAlign: 'right' }}>#{r.organicRank}</td>
                <td style={{ textAlign: 'right' }}>{(r.searchVolume ?? 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{(r.cerebroIq ?? 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{r.titleDensity ?? '—'}</td>
                <td>{r.competing ?? '—'}</td>
              </tr>
            ))}
            {rows != null && view.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, color: '#888' }}>
                {rows.length === 0 ? 'No ranked-keyword data yet — run a scan first.' : 'No keywords match the current filter.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

'use client';
import { useState, useEffect, useRef } from 'react';

const TOKEN = process.env.NEXT_PUBLIC_PORTAL_API_TOKEN ?? '';
const auth = { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` };

async function streamInto(url, payload, onChunk) {
  const res = await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify(payload) });
  if (!res.ok || !res.body) { onChunk(`[error ${res.status}]`); return; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onChunk(dec.decode(value, { stream: true }));
  }
}

const card = { background: '#fff', border: '1px solid #e5e5e0', borderRadius: 10, padding: 16, marginBottom: 16 };
const btn = { padding: '9px 16px', background: '#5b21b6', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const out = { whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5, marginTop: 12, color: '#1a1a1a' };

export default function AIPanel() {
  // Brief
  const [brief, setBrief] = useState('');
  const [briefBusy, setBriefBusy] = useState(false);
  // Chat
  const [chat, setChat] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef(null);
  // Teardown
  const [competitors, setCompetitors] = useState([]);
  const [asin, setAsin] = useState('');
  const [teardown, setTeardown] = useState('');
  const [tdBusy, setTdBusy] = useState(false);

  useEffect(() => {
    fetch('/api/teardown', { headers: auth })
      .then((r) => (r.ok ? r.json() : { competitors: [] }))
      .then((d) => setCompetitors(d.competitors || []))
      .catch(() => {});
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  async function genBrief() {
    setBriefBusy(true); setBrief('');
    try { await streamInto('/api/brief', {}, (t) => setBrief((s) => s + t)); }
    finally { setBriefBusy(false); }
  }

  async function send() {
    const q = input.trim();
    if (!q || chatBusy) return;
    setInput('');
    const history = [...chat, { role: 'user', content: q }];
    setChat([...history, { role: 'assistant', content: '' }]);
    setChatBusy(true);
    try {
      await streamInto('/api/chat', { messages: history }, (t) =>
        setChat((c) => { const copy = [...c]; copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + t }; return copy; })
      );
    } finally { setChatBusy(false); }
  }

  async function runTeardown() {
    if (!asin || tdBusy) return;
    setTdBusy(true); setTeardown('');
    try { await streamInto('/api/teardown', { asin }, (t) => setTeardown((s) => s + t)); }
    finally { setTdBusy(false); }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>🧠 AI</h2>

      {/* Weekly Brief */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong style={{ fontSize: 15 }}>Weekly Intelligence Brief</strong>
          <button onClick={genBrief} disabled={briefBusy} style={{ ...btn, opacity: briefBusy ? 0.5 : 1 }}>
            {briefBusy ? 'Analyzing…' : 'Generate brief'}
          </button>
        </div>
        {brief && <div style={out}>{brief}</div>}
      </div>

      {/* Ask your data */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>Ask your data</strong>
        <div style={{ maxHeight: 280, overflowY: 'auto', margin: '10px 0' }}>
          {chat.length === 0 && <div style={{ color: '#999', fontSize: 13 }}>e.g. “Which keywords improved most?” · “What should I bid on?” · “Where am I losing to competitors?”</div>}
          {chat.map((m, i) => (
            <div key={i} style={{ margin: '8px 0' }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{m.role === 'user' ? 'You' : 'Claude'}</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5 }}>{m.content || (m.role === 'assistant' ? '…' : '')}</div>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask about your keywords or competitors…"
            style={{ flex: 1, padding: '9px 12px', border: '1px solid #d4d4cf', borderRadius: 8, fontSize: 14 }}
          />
          <button onClick={send} disabled={chatBusy} style={{ ...btn, opacity: chatBusy ? 0.5 : 1 }}>Send</button>
        </div>
      </div>

      {/* Competitor teardown */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>Competitor teardown</strong>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <select value={asin} onChange={(e) => setAsin(e.target.value)} style={{ flex: 1, minWidth: 240, padding: '9px 10px', border: '1px solid #d4d4cf', borderRadius: 8, fontSize: 13 }}>
            <option value="">Select a competitor…</option>
            {competitors.map((c) => (
              <option key={c.asin} value={c.asin}>{(c.title || c.asin).slice(0, 60)} — {c.asin} ({c.keywordCount} kw, {c.reviewCount} reviews)</option>
            ))}
          </select>
          <button onClick={runTeardown} disabled={!asin || tdBusy} style={{ ...btn, opacity: !asin || tdBusy ? 0.5 : 1 }}>
            {tdBusy ? 'Analyzing…' : 'Tear down'}
          </button>
        </div>
        {teardown && <div style={out}>{teardown}</div>}
      </div>
    </div>
  );
}

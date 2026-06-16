import { requireToken } from '../../../lib/auth';
import { streamText } from '../../../lib/claude';
import { gatherData, dataToText } from '../../../lib/kccData';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM = `You are an Amazon keyword analytics assistant for a seller. Answer the user's questions using ONLY the keyword and competitor data provided to you. Be concise and specific — cite exact numbers (search volumes, organic ranks, weekly deltas, prices, review counts, competitor ASINs). If the data does not contain the answer, say so plainly. weekly_delta positive = rank improved. Keep answers tight; use markdown only when it helps.`;

export async function POST(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { messages = [] } = await req.json().catch(() => ({}));
  const turns = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content);
  if (!turns.length) return new Response('No question.', { status: 400 });

  const data = await gatherData();
  const block = dataToText(data);

  // Cache the (large, stable) data context across chat turns; the conversation follows.
  const body = streamText({
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      { role: 'user', content: [{ type: 'text', text: block, cache_control: { type: 'ephemeral' } }] },
      { role: 'assistant', content: 'I have the full keyword and competitor dataset loaded. What would you like to know?' },
      ...turns.map((m) => ({ role: m.role, content: String(m.content) })),
    ],
    maxTokens: 2000,
    effort: 'medium',
  });
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

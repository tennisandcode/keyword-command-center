import Anthropic from '@anthropic-ai/sdk';

// Lazy so `next build` doesn't require ANTHROPIC_API_KEY at import time.
let _client;
function anthropic() {
  return (_client ??= new Anthropic()); // reads ANTHROPIC_API_KEY
}

// Latest, most capable model.
export const MODEL = 'claude-opus-4-8';
// Cheap, fast model for small structured tasks (e.g. interpreting a sort request).
export const FAST_MODEL = 'claude-haiku-4-5';

// One-shot structured output validated against a JSON schema. Returns the parsed object.
export async function structured({ model = FAST_MODEL, system, user, schema, maxTokens = 1024 }) {
  const res = await anthropic().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const txt = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(txt);
}

// Stream a Claude response as a plain-text ReadableStream for a Next.js Response.
export function streamText({ system, messages, maxTokens = 6000, effort }) {
  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    ...(effort ? { output_config: { effort } } : {}),
    system,
    messages,
  });
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        stream.on('text', (t) => controller.enqueue(encoder.encode(t)));
        await stream.finalMessage();
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[AI error: ${String(e?.message ?? e)}]`));
      } finally {
        controller.close();
      }
    },
  });
}

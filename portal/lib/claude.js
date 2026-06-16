import Anthropic from '@anthropic-ai/sdk';

// Lazy so `next build` doesn't require ANTHROPIC_API_KEY at import time.
let _client;
function anthropic() {
  return (_client ??= new Anthropic()); // reads ANTHROPIC_API_KEY
}

// Latest, most capable model.
export const MODEL = 'claude-opus-4-8';

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

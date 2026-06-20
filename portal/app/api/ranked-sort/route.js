import { requireToken } from '../../../lib/auth';
import { structured } from '../../../lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const COLUMNS = ['organicRank', 'searchVolume', 'cerebroIq', 'titleDensity', 'keyword'];

const SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sortBy: { type: 'string', enum: COLUMNS },
    sortDir: { type: 'string', enum: ['asc', 'desc'] },
    filters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          column: { type: 'string', enum: COLUMNS },
          op: { type: 'string', enum: ['lte', 'gte', 'eq', 'contains'] },
          value: { type: 'string' },
        },
        required: ['column', 'op', 'value'],
      },
    },
    explanation: { type: 'string' },
  },
  required: ['sortBy', 'sortDir', 'filters', 'explanation'],
};

const SYSTEM = `You translate a seller's natural-language request into a sort+filter spec for a table of the Amazon keywords they organically RANK for.
Columns: organicRank (their organic position, LOWER = better), searchVolume (monthly searches), cerebroIq, titleDensity, keyword (text).
Ops: lte (<=), gte (>=), eq (=), contains (substring match — keyword column only).
Return ONLY the spec. Put numeric values as plain numbers inside the value string. If no filter is implied, return an empty filters array. Choose the most useful sort if the user didn't specify one. "explanation" is one short sentence describing what you applied.`;

export async function POST(req) {
  if (!requireToken(req)) return new Response('unauthorized', { status: 401 });
  const { request: q } = await req.json().catch(() => ({}));
  if (!q) return Response.json({ error: 'request required' }, { status: 400 });
  try {
    const spec = await structured({ system: SYSTEM, user: String(q), schema: SPEC_SCHEMA });
    return Response.json(spec);
  } catch (e) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}

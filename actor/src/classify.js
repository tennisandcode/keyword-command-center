// Pure logic: dedupe, relevance filter, opportunity classification.
// Kept dependency-free so it's unit-testable without a browser.

const IRRELEVANT_PATTERNS = [
  /wet dry vacuum/i,
  /food (saver|sealer)/i,
  /^vacuum sealer$/i,
  /water backpack|hydration/i,
  /kids?|toddler|school bookbag/i,
];

const TOO_GENERIC = new Set(['travel', 'bag', 'bags', 'luggage sets']);

export function classifyKeywords(rows, { known, brandBlocklist, highOppVolume, highOppRankMax }) {
  const block = brandBlocklist.map((b) => b.toLowerCase());

  // Track discards with reasons — they become negative-keyword candidates (v2).
  const discarded = [];
  const reasonFor = (r) => {
    const kw = r.keyword.toLowerCase();
    if (block.some((b) => kw.includes(b))) return 'branded competitor term';
    if (IRRELEVANT_PATTERNS.some((re) => re.test(r.keyword))) return 'irrelevant product type';
    if (TOO_GENERIC.has(kw)) return 'too generic';
    return null;
  };
  for (const r of rows) {
    if (known.has(r.keyword.toLowerCase())) continue;
    const reason = reasonFor(r);
    if (reason) discarded.push({ ...r, discarded: true, discardReason: reason });
  }

  const kept = rows
    .filter((r) => !known.has(r.keyword.toLowerCase()))
    .filter((r) => !block.some((b) => r.keyword.toLowerCase().includes(b)))
    .filter((r) => !IRRELEVANT_PATTERNS.some((re) => re.test(r.keyword)))
    .filter((r) => !TOO_GENERIC.has(r.keyword.toLowerCase()))
    .map((r) => ({
      ...r,
      classification:
        r.searchVolume >= highOppVolume && r.organicRank <= highOppRankMax
          ? 'high_opportunity'
          : 'standard',
      todoAction:
        r.searchVolume >= highOppVolume && r.organicRank <= highOppRankMax
          ? 'Add to listing/PPC and push ranking'
          : 'Evaluate for backend keywords',
    }));

  const highOpportunity = kept
    .filter((k) => k.classification === 'high_opportunity')
    .sort((a, b) => b.searchVolume - a.searchVolume);

  return { kept, highOpportunity, discarded };
}

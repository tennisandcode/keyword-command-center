// PPC Master Optimizer: turns scored keywords into a concrete weekly ad plan.
import { parseCount } from './analysis.js';

/**
 * Build the weekly PPC plan from scored, lifecycle-classified keywords.
 * Returns campaign actions, bid recommendations, negatives, and budget split.
 */
export function buildPpcPlan(keywords, { weeklyBudget = 500 } = {}) {
  const active = keywords.filter((k) => k.score >= 30);

  const actions = active.map((k) => {
    const bid = k.suggestedBid ?? null;
    const matchType = pickMatchType(k);
    return {
      keyword: k.keyword,
      score: k.score,
      state: k.state ?? 'new',
      matchType,
      suggestedBid: bid ? round2(adjustBid(bid, k)) : null,
      topOfSearchModifier: k.state === 'stalled' ? '+50%' : k.score >= 70 ? '+25%' : null,
      campaign: campaignFor(k, matchType),
    };
  });

  // Budget allocation proportional to score² (concentrates spend on winners).
  const totalSq = active.reduce((s, k) => s + k.score ** 2, 0) || 1;
  for (const a of actions) {
    a.weeklyBudgetShare = round2((weeklyBudget * (a.score ** 2)) / totalSq);
  }

  return {
    actions: actions.sort((a, b) => b.score - a.score),
    negatives: suggestNegatives(keywords),
    summary: {
      totalKeywords: actions.length,
      weeklyBudget,
      exactCount: actions.filter((a) => a.matchType === 'exact').length,
      phraseCount: actions.filter((a) => a.matchType === 'phrase').length,
      broadCount: actions.filter((a) => a.matchType === 'broad').length,
    },
  };
}

function pickMatchType(k) {
  if (k.score >= 60 || k.state === 'climbing' || k.state === 'won') return 'exact';
  if (k.score >= 45) return 'phrase';
  return 'broad';
}

function adjustBid(bid, k) {
  // Aggressive on climbers and high scores, conservative on tests.
  if (k.state === 'decaying') return bid * 1.25;
  if (k.state === 'climbing' || k.score >= 70) return bid * 1.15;
  if (k.score < 45) return bid * 0.7;
  return bid;
}

function campaignFor(k, matchType) {
  if (k.state === 'won') return 'BV-Defend-Exact';
  if (matchType === 'exact') return 'BV-Attack-Exact';
  if (matchType === 'phrase') return 'BV-Grow-Phrase';
  return 'BV-Research-Broad';
}

/**
 * Negative keyword candidates: discarded terms (branded/irrelevant) become
 * negatives so broad/auto campaigns stop paying for them.
 */
export function suggestNegatives(allKeywords) {
  return allKeywords
    .filter((k) => k.discarded)
    .map((k) => ({
      keyword: k.keyword,
      matchType: 'negative exact',
      reason: k.discardReason ?? 'irrelevant/branded',
    }));
}

/** Realized performance check (for the learning loop, fed from portal todos). */
export function evaluatePlanOutcomes(prevPlan, rankHistories) {
  if (!prevPlan?.actions) return [];
  return prevPlan.actions.map((a) => {
    const hist = rankHistories[a.keyword] ?? [];
    const delta = hist.length >= 2 ? hist[0].organicRank - hist.at(-1).organicRank : null;
    return { keyword: a.keyword, plannedBid: a.suggestedBid, rankDelta: delta,
             verdict: delta == null ? 'no-data' : delta >= 3 ? 'working' : delta <= -3 ? 'failing' : 'flat' };
  });
}

const round2 = (x) => Math.round(x * 100) / 100;
export { parseCount };

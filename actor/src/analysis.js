// Precision analysis engine: opportunity scoring, lifecycle states, learning loop.
// Pure functions — no I/O — so every rule is unit-testable.

/**
 * Opportunity Score 0–100. Four multiplicative factors, weighted geometric mean:
 *  - volume:      log-scaled search volume (more demand = more upside)
 *  - winnability: how close current rank is to page 1 (rank 20–50 sweet spot)
 *  - weakness:    competition softness (low title density + fewer competing products)
 *  - trend:       search volume trend (rising terms compound)
 */
export function opportunityScore(k) {
  // volume: 200 → 0, ~630k → 1.0 (log scale anchored to a meaningful floor)
  const volume = clamp(Math.log10(Math.max(k.searchVolume, 1) / 200) / 3.5, 0, 1);
  const winnability =
    k.organicRank <= 10 ? 0.35 :            // already page 1 — defend, less upside
    k.organicRank <= 50 ? 1 - (k.organicRank - 10) / 55 :
    clamp(1 - (k.organicRank - 10) / 110, 0.1, 1);
  const titleDensitySoftness = clamp(1 - (k.titleDensity ?? 0) / 30, 0.2, 1);
  const competingSoftness = clamp(1 - Math.log10(Math.max(parseCount(k.competingProducts), 10)) / 6, 0.15, 1);
  const weakness = (titleDensitySoftness + competingSoftness) / 2;
  const trend = clamp(0.5 + (k.searchVolumeTrend ?? 0) / 200, 0.3, 1);

  // Weighted arithmetic blend — calibrated so a 300k-volume rank-41 keyword
  // lands ~58 and a 500-volume rank-79 keyword lands ~36.
  const score = 100 * (0.4 * volume + 0.3 * winnability + 0.2 * weakness + 0.1 * trend);
  return Math.round(clamp(score, 0, 100));
}

/** Estimated cost to rank: CPR units × price × ACOS-adjusted ad spend proxy. */
export function costToRank(k, productPrice = 148.99) {
  const cpr = k.cpr ?? null;
  const bid = k.suggestedBid ?? null;
  if (!cpr && !bid) return null;
  // CPR = units over 8 days needed to reach page 1. Approximate ad cost:
  // assume 10% CVR → clicks needed = units/0.10, cost = clicks × bid.
  const units = cpr ?? 8;
  const clicks = units / 0.1;
  const adCost = bid ? Math.round(clicks * bid) : null;
  return { unitsOver8Days: units, estClicks: Math.round(clicks), estAdCost: adCost, productPrice };
}

/**
 * Lifecycle classification from rank history (array of {date, organicRank}, oldest first).
 * States: new | climbing | stalled | won | decaying | lost
 */
export function lifecycle(history) {
  if (!history || history.length === 0) return { state: 'new', velocity: null };
  const ranks = history.map((h) => h.organicRank).filter((r) => r > 0);
  if (ranks.length < 2) return { state: 'new', velocity: null };

  const current = ranks.at(-1);
  const prev = ranks.at(-2);
  // velocity: positions gained per snapshot (positive = improving)
  const recent = ranks.slice(-4);
  const velocity = round1((recent[0] - recent.at(-1)) / Math.max(recent.length - 1, 1));

  if (current <= 10) return { state: 'won', velocity };
  if (current > 100 && prev <= 100) return { state: 'lost', velocity };
  if (velocity >= 2) return { state: 'climbing', velocity };
  if (velocity <= -2) return { state: 'decaying', velocity };
  // stalled: 3+ snapshots with < 2 positions of total movement
  if (ranks.length >= 3) {
    const window = ranks.slice(-3);
    if (Math.max(...window) - Math.min(...window) <= 2) return { state: 'stalled', velocity };
  }
  return { state: 'tracking', velocity };
}

/** Tactic recommendation per lifecycle state — the "what do I do now" layer. */
export function recommendAction(k, life, ctr = {}) {
  const base = { keyword: k.keyword, score: k.score, state: life.state };
  switch (life.state) {
    case 'won':
      return { ...base, priority: 'maintain', action:
        'Defend: keep exact-match campaign live at maintenance bid; harvest into Sponsored Brand.' };
    case 'climbing':
      return { ...base, priority: 'high', action:
        `Accelerate: rank improving ${life.velocity}/wk — raise exact bid 15–20% and add to title/bullets if absent.` };
    case 'stalled':
      return { ...base, priority: 'high', action:
        'Change tactic: 3+ weeks flat. Rotate creative/main image test, try exact-match top-of-search modifier +50%, check listing relevance for this phrase.' };
    case 'decaying':
      return { ...base, priority: 'urgent', action:
        `Rescue: losing ${Math.abs(life.velocity)}/wk. Audit competitor undercuts (price/coupon), re-run CPR push, verify stock/buybox.` };
    case 'lost':
      return { ...base, priority: 'medium', action:
        'Re-evaluate: fell off top 100. Decide — re-attack with CPR campaign or drop and reallocate budget.' };
    default:
      return { ...base, priority: k.score >= 60 ? 'high' : 'medium', action:
        k.score >= 60
          ? 'Attack: launch exact-match campaign at suggested bid, add phrase to backend keywords today.'
          : 'Test: add as broad/phrase in research campaign at 70% of suggested bid; promote if CTR > 0.3%.' };
  }
}

/**
 * Learning loop: compare past to-dos marked done against subsequent rank movement.
 * Returns win-rate per action type and a weight adjustment for future prioritization.
 */
export function learnFromHistory(actionedTodos, rankHistories) {
  const outcomes = [];
  for (const todo of actionedTodos) {
    const hist = rankHistories[todo.keyword];
    if (!hist || hist.length < 2) continue;
    const after = hist.filter((h) => new Date(h.date) > new Date(todo.completedAt));
    if (after.length < 2) continue;
    const delta = after[0].organicRank - after.at(-1).organicRank; // positive = improved
    outcomes.push({ keyword: todo.keyword, action: todo.action, rankDelta: delta, win: delta >= 3 });
  }
  const byAction = {};
  for (const o of outcomes) {
    byAction[o.action] ??= { attempts: 0, wins: 0, avgDelta: 0 };
    const a = byAction[o.action];
    a.avgDelta = (a.avgDelta * a.attempts + o.rankDelta) / (a.attempts + 1);
    a.attempts += 1;
    if (o.win) a.wins += 1;
  }
  for (const a of Object.values(byAction)) {
    a.winRate = round1(a.wins / a.attempts);
    a.avgDelta = round1(a.avgDelta);
  }
  return { outcomes, byAction };
}

export function parseCount(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/[^0-9]/g, ''));
  return n || 0;
}
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
const round1 = (x) => Math.round(x * 10) / 10;

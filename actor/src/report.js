// Weekly report writer: human-readable markdown + machine-readable JSON.
// The actor pushes both to the Apify key-value store; the portal and the local
// vault sync job download them.

export function weeklyReportMarkdown({ asin, date, scored, lifecycleMap, competitorSets, ppcPlan, learning }) {
  const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, 15);
  const lines = [];
  lines.push(`# Weekly Keyword Report — ${asin} — ${date}`, '');
  lines.push(`**Keywords analyzed:** ${scored.length} | **High opportunity (score ≥ 60):** ${scored.filter((k) => k.score >= 60).length}`, '');

  lines.push('## Top opportunities', '');
  lines.push('| # | Keyword | Score | Volume | Rank | State | Est. ad cost to rank |');
  lines.push('|---|---------|-------|--------|------|-------|----------------------|');
  top.forEach((k, i) => {
    const ctr = k.costToRank?.estAdCost ? `$${k.costToRank.estAdCost}` : '—';
    lines.push(`| ${i + 1} | ${k.keyword} | ${k.score} | ${fmt(k.searchVolume)} | #${k.organicRank} | ${lifecycleMap[k.keyword]?.state ?? 'new'} | ${ctr} |`);
  });

  lines.push('', '## Lifecycle alerts', '');
  for (const [kw, life] of Object.entries(lifecycleMap)) {
    if (['stalled', 'decaying', 'lost'].includes(life.state)) {
      lines.push(`- ⚠️ **${kw}** is ${life.state} (velocity ${life.velocity ?? '?'}/wk)`);
    }
    if (life.state === 'won') lines.push(`- 🏆 **${kw}** reached page 1`);
  }

  lines.push('', '## Competitor X-ray', '');
  for (const set of competitorSets) {
    lines.push(`### "${set.keyword}"`);
    const sov = set.shareOfVoice?.slice(0, 3).map((s) => `${s.brand} ${s.pct}%`).join(', ');
    if (sov) lines.push(`Share of voice: ${sov}`);
    if (set.attackTarget) {
      lines.push(`**Attack target:** ${set.attackTarget.asin} (weakness ${set.attackTarget.weakness}/100 — ` +
        `${set.attackTarget.keywordInTitle ? 'keyword in title' : 'keyword NOT in title'}, ` +
        `${set.attackTarget.reviewCount ?? '?'} reviews, ${set.attackTarget.rating ?? '?'}★)`);
    }
    lines.push('');
  }

  lines.push('## PPC plan this week', '');
  lines.push(`Budget $${ppcPlan.summary.weeklyBudget} → ${ppcPlan.summary.exactCount} exact / ${ppcPlan.summary.phraseCount} phrase / ${ppcPlan.summary.broadCount} broad`, '');
  lines.push('| Keyword | Match | Bid | ToS mod | Campaign | Weekly $ |');
  lines.push('|---------|-------|-----|---------|----------|----------|');
  for (const a of ppcPlan.actions.slice(0, 20)) {
    lines.push(`| ${a.keyword} | ${a.matchType} | ${a.suggestedBid ? '$' + a.suggestedBid : '—'} | ${a.topOfSearchModifier ?? '—'} | ${a.campaign} | $${a.weeklyBudgetShare} |`);
  }
  if (ppcPlan.negatives.length) {
    lines.push('', `**New negative keywords (${ppcPlan.negatives.length}):** ` +
      ppcPlan.negatives.slice(0, 15).map((n) => n.keyword).join(', '));
  }

  if (learning?.byAction && Object.keys(learning.byAction).length) {
    lines.push('', '## What worked (learning loop)', '');
    for (const [action, st] of Object.entries(learning.byAction)) {
      lines.push(`- "${action.slice(0, 60)}…": ${Math.round(st.winRate * 100)}% win rate over ${st.attempts} attempts (avg ${st.avgDelta > 0 ? '+' : ''}${st.avgDelta} positions)`);
    }
  }

  return lines.join('\n');
}

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : n ?? '—');

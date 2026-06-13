# Changelog

## v2 (2026-06-13) — Precision pipeline

**5x more keywords.** Cerebro extraction now paginates with 100 rows/page up to 150 keywords per ASIN per run (was 30).

**Opportunity Score 0–100.** Every keyword gets a score from log-scaled volume, rank winnability, competition weakness (title density + competing products), and search-volume trend. Calibrated so a 300k-volume rank-41 keyword scores 58 and a 500-volume rank-79 keyword scores 37. Unit-tested.

**Lifecycle states + velocity.** Each keyword is tagged `new | climbing | stalled | won | decaying | lost` based on rank history. Velocity = positions gained per snapshot over the last 4 runs. Drives different actions per state.

**Deep competitor X-ray.** Beyond top-5 SERP capture, the actor visits each product page and pulls full title, bullets, BSR + category, image count, A+ presence, video presence, coupon badge. A weakness score 0–100 identifies the most attackable competitor per keyword. Share-of-voice shows brand concentration.

**Cost-to-rank math.** For keywords with Cerebro CPR + suggested bid, computes estimated units / clicks / ad spend to reach page 1.

**PPC Master Plan.** New `ppc.js` generates a full weekly plan: match type per keyword (exact/phrase/broad by score), bid adjustments by lifecycle state, top-of-search modifiers, budget allocation proportional to score², negative keywords from discarded terms. Budget sums to exactly the configured weekly total.

**Learning loop.** `learnFromHistory` analyzes which past to-do actions correlated with rank gains. Win rate + average rank delta per action type feeds back into next week's recommendations.

**Weekly markdown reports.** `report.js` writes a human-readable report per ASIN per run: top opportunities table, lifecycle alerts, competitor X-ray with attack targets, full PPC plan, learning insights. Saved to the Apify KV store `kcc-reports` and to the local vault.

**Local data vault.** `/Users/video/Amazon Cerebro KW Scan/` mounts as the permanent home: `runs/` (JSON), `reports/` (markdown), `plans/` (PPC plans), `competitors/` (X-rays), `skills/ppc-master-optimizer/SKILL.md`, and a full copy of the v2 source.

**PPC Master Optimizer skill.** SKILL.md in the vault defines the weekly procedure: defend wins, accelerate climbers, rescue decayers, unstick stalls, launch attacks on score ≥60, apply negatives, allocate by score². Triggers on PPC/ads/bids/campaign/keyword report.

**Portal Insights page.** New `/insights` route shows week-over-week rank movement per keyword with color-coded deltas. `/api/insights` returns the same data as JSON.

**Tracked in Postgres.** Added `rankHistories` and `actionedTodos` queries that feed lifecycle classification and the learning loop.

## v1 (2026-06-11)

Initial scaffolding — Apify actor + Next.js portal + Sheets sync + scheduled Monday runs with login handoff.

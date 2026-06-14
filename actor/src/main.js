// H10 Keyword Finder v2 — precision pipeline.
// Cerebro (150 kw) → classify → score + lifecycle + learning → deep competitor
// X-ray → PPC plan → persist (Postgres + Sheets + KV reports) → portal webhook.
import { Actor, log } from 'apify';
import { chromium } from 'playwright';
import { runCerebro, ensureLoggedIn } from './cerebro.js';
import { startLiveView } from './liveview.js';
import { classifyKeywords } from './classify.js';
import { opportunityScore, costToRank, lifecycle, recommendAction, learnFromHistory } from './analysis.js';
import { deepCompetitorAnalysis } from './competitor-deep.js';
import { buildPpcPlan } from './ppc.js';
import { weeklyReportMarkdown } from './report.js';
import { syncSheet } from './sheets.js';
import * as db from './db.js';

const SESSION_STORE = 'h10-session';
const REPORT_STORE = 'kcc-reports';

await Actor.main(async () => {
  const input = (await Actor.getInput()) ?? {};
  const {
    asins = [],
    minSearchVolume = 400,
    rankMin = 20,
    rankMax = 80,
    highOppVolume = 800,
    highOppRankMax = 50,
    maxKeywords = 150,
    maxCompetitorLookups = 3,
    deepCompetitors = true,
    weeklyPpcBudget = 500,
    productPrice = 148.99,
    loginWaitMinutes = 10,
    brandBlocklist = [],
  } = input;

  let products = asins.map((asin) => ({ asin }));
  if (!products.length && process.env.PORTAL_URL) {
    const res = await fetch(`${process.env.PORTAL_URL}/api/products?active=1`, {
      headers: { authorization: `Bearer ${process.env.PORTAL_API_TOKEN}` },
    });
    products = await res.json();
  }
  if (!products.length) throw new Error('No ASINs provided and portal returned none.');

  const sessionStore = await Actor.openKeyValueStore(SESSION_STORE);
  const reportStore = await Actor.openKeyValueStore(REPORT_STORE);
  const storageState = (await sessionStore.getValue('storageState')) ?? undefined;

  // Headful Google Chrome under xvfb so the attended Helium 10 login works in
  // Apify Live View. Raw Playwright (not Crawlee's incognito-wrapped browser)
  // so newContext({ storageState }) can restore the saved session.
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  startLiveView(); // serve noVNC so a human can complete the H10 login in Live View
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  const loggedIn = await ensureLoggedIn(page, { loginWaitMinutes });
  if (!loggedIn) {
    await Actor.setStatusMessage('NEEDS_LOGIN: open Live View and sign in.');
    throw new Error(`H10 session expired; no login within ${loginWaitMinutes} min.`);
  }
  await sessionStore.setValue('storageState', await context.storageState());

  const runStartedAt = new Date().toISOString();
  const date = runStartedAt.slice(0, 10);
  const pg = await db.connect();
  const summary = [];

  for (const { asin } of products) {
    log.info(`=== ${asin} ===`);
    const raw = await runCerebro(page, asin, { minSearchVolume, rankMin, rankMax, maxKeywords });

    const known = pg ? await db.knownKeywords(pg, asin) : new Set();
    const histories = pg ? await db.rankHistories(pg, asin) : {};
    const doneTodos = pg ? await db.actionedTodos(pg, asin) : [];

    const { kept, discarded } = classifyKeywords(raw, {
      known: new Set(), // score ALL relevant keywords each run; dedupe handled by upsert
      brandBlocklist, highOppVolume, highOppRankMax,
    });

    // ---- Precision layer -------------------------------------------------
    const lifecycleMap = {};
    const scored = kept.map((k) => {
      const score = opportunityScore(k);
      const life = lifecycle(histories[k.keyword]);
      lifecycleMap[k.keyword] = life;
      return {
        ...k, score,
        state: life.state,
        velocity: life.velocity,
        costToRank: costToRank(k, productPrice),
        isNew: !known.has(k.keyword.toLowerCase()),
      };
    }).sort((a, b) => b.score - a.score);

    const recommendations = scored.map((k) => recommendAction(k, lifecycleMap[k.keyword]));
    const learning = learnFromHistory(doneTodos, histories);

    // ---- Deep competitor X-ray on top NEW high-score keywords ------------
    const targets = scored.filter((k) => k.isNew && k.score >= 55).slice(0, maxCompetitorLookups);
    const competitorSets = [];
    const amazonPage = await context.newPage();
    for (const kw of targets) {
      competitorSets.push(
        deepCompetitors
          ? await deepCompetitorAnalysis(amazonPage, kw.keyword)
          : { keyword: kw.keyword, competitors: [], shareOfVoice: [], attackTarget: null }
      );
    }
    await amazonPage.close();

    // ---- PPC plan + report ------------------------------------------------
    const ppcPlan = buildPpcPlan([...scored, ...discarded], { weeklyBudget: weeklyPpcBudget });
    const report = weeklyReportMarkdown({ asin, date, scored, lifecycleMap, competitorSets, ppcPlan, learning });

    await reportStore.setValue(`report-${asin}-${date}.md`, report, { contentType: 'text/markdown' });
    await reportStore.setValue(`data-${asin}-${date}.json`,
      { asin, date, scored, recommendations, competitorSets, ppcPlan, learning });

    // ---- Persist -----------------------------------------------------------
    const newKeywords = scored.filter((k) => k.isNew);
    if (pg) await db.persistRun(pg, { asin, runStartedAt, kept: newKeywords, competitorSets:
      competitorSets.map((s) => ({ keyword: s.keyword, competitors: s.competitors })) });
    await syncSheet({ asin, kept: newKeywords, competitorSets:
      competitorSets.map((s) => ({ keyword: s.keyword, competitors: s.competitors })), runStartedAt });

    summary.push({
      asin, scanned: raw.length, scored: scored.length, newKeywords: newKeywords.length,
      avgScore: Math.round(scored.reduce((s, k) => s + k.score, 0) / Math.max(scored.length, 1)),
      alerts: Object.entries(lifecycleMap)
        .filter(([, l]) => ['stalled', 'decaying', 'lost'].includes(l.state))
        .map(([kw, l]) => `${kw}:${l.state}`),
      topOpportunities: scored.slice(0, 5).map((k) => `${k.keyword} (${k.score})`),
      reportKey: `report-${asin}-${date}.md`,
    });
    await Actor.pushData(summary.at(-1));
  }

  if (pg) await pg.end();
  await browser.close();

  if (process.env.PORTAL_URL) {
    await fetch(`${process.env.PORTAL_URL}/api/runs/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.PORTAL_API_TOKEN}` },
      body: JSON.stringify({ runStartedAt, summary }),
    }).catch((e) => log.warning(`Portal webhook failed: ${e.message}`));
  }

  await Actor.setStatusMessage(
    `v2 done: ${summary.length} ASIN(s), ${summary.reduce((n, s) => n + s.newKeywords, 0)} new keywords, reports in KV "${REPORT_STORE}".`
  );
});

// Helium 10 Cerebro automation. Selectors verified against cerebro-new (June 2026).
import { Actor, log } from 'apify';
import { readFileSync } from 'fs';

const CEREBRO_URL = 'https://members.helium10.com/cerebro';

/**
 * True if we land on Cerebro logged-in on a PAID plan; false if login needed.
 * If the login page is shown, waits up to loginWaitMinutes for a human to
 * complete login through Apify Live View, polling for success.
 */
const SIGNIN_URL = 'https://members.helium10.com/user/signin';

export async function ensureLoggedIn(context, page, { loginWaitMinutes = 10 } = {}) {
  await page.goto(CEREBRO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const state = await sessionState(page);
  if (state === 'ok') return true;
  if (state === 'demo') {
    throw new Error(
      'Logged into a FREE Helium 10 account ("demo of Cerebro" banner). ' +
      'Use the paid (Elite) account credentials, then re-run.'
    );
  }

  // The H10 login uses INVISIBLE reCAPTCHA (no checkbox), so try clicking Log In
  // ourselves — on real Chrome it often passes with no human at all.
  const email = process.env.H10_EMAIL;
  const password = process.env.H10_PASSWORD;
  if (email && password) {
    await prefillLogin(page, email, password);
    await clickLogin(page);
    await page.waitForTimeout(8_000);
    await page.goto(CEREBRO_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3_000);
    if ((await sessionState(page)) === 'ok') {
      log.info('Auto-login succeeded (invisible reCAPTCHA passed).');
      return true;
    }
    log.warning('Auto-login did not reach Cerebro — re-filling form for manual Live View login.');
    await prefillLogin(page, email, password);
  }

  log.warning(
    'LOGIN NEEDED → open this run\'s "Live view" tab, solve the reCAPTCHA, and click "Log In". ' +
    (email && password ? 'Email/password are pre-filled. ' : 'No H10_EMAIL/H10_PASSWORD set. ') +
    `Waiting up to ${loginWaitMinutes} min…`
  );
  await Actor.setStatusMessage('NEEDS_LOGIN: open Live View, solve captcha, click Log In.').catch(() => {});

  const deadline = Date.now() + loginWaitMinutes * 60_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(5_000);
    // Diagnostic: snapshot what the operator sees in Live View (default KV store).
    try {
      await Actor.setValue('login-screen', await page.screenshot(), { contentType: 'image/png' });
    } catch (e) {
      log.warning(`login-screen capture failed: ${e?.message ?? e}`);
    }
    log.info(`login-wait: page is at ${page.url()}`);
    // Did any tab in this context reach a logged-in H10 page (left the signin)?
    const loggedInSomewhere = context.pages().some((p) => {
      const u = p.url();
      return /helium10\.com/.test(u) && !/\/user\/signin/.test(u) && !/about:blank/.test(u);
    });
    if (loggedInSomewhere) {
      // Confirm on our page (shares the persistent context's cookies).
      await page.goto(CEREBRO_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(3_000);
      if ((await sessionState(page)) === 'ok') {
        log.info('Login detected — continuing.');
        return true;
      }
    } else if (email && password) {
      // Still on signin (e.g. reloaded after a failed attempt) — keep it filled.
      const empty = await page
        .locator('#loginform-email')
        .inputValue()
        .then((v) => !v)
        .catch(() => false);
      if (empty) await prefillLogin(page, email, password, true);
    }
  }
  return false;
}

/** Pre-fill the H10 signin form (does NOT submit — the human solves the captcha). */
async function prefillLogin(page, email, password, alreadyOnPage = false) {
  try {
    if (!alreadyOnPage && !/\/user\/signin/.test(page.url())) {
      await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded' });
    }
    await page.locator('#loginform-email').waitFor({ timeout: 15_000 });
    await page.locator('#loginform-email').fill(email);
    await page.locator('#loginform-password').fill(password);
    log.info('Helium 10 credentials pre-filled.');
  } catch (e) {
    log.warning(`prefillLogin error: ${e?.message ?? e}`);
  }
}

/** Click the "Log In" button (invisible reCAPTCHA runs on submit). */
async function clickLogin(page) {
  try {
    const btn = page
      .locator('#login-form button[type="submit"], button:has-text("Log In"), button:has-text("LOG IN")')
      .first();
    await btn.waitFor({ timeout: 8_000 });
    await btn.click();
    log.info('Clicked Log In — waiting for invisible reCAPTCHA / redirect.');
  } catch (e) {
    log.warning(`clickLogin error: ${e?.message ?? e}`);
  }
}

async function sessionState(page) {
  const url = page.url();
  if (/\/user\/signin/.test(url)) return 'login';
  const demo = await page
    .locator('text=You are viewing a demo of Cerebro')
    .count()
    .catch(() => 0);
  if (demo) return 'demo';
  const onCerebro = /cerebro/.test(url);
  return onCerebro ? 'ok' : 'login';
}

/** Run Cerebro for one ASIN, apply filters, return sorted keyword rows. */
export async function runCerebro(page, asin, { minSearchVolume, rankMin, rankMax, maxKeywords }) {
  await page.goto(CEREBRO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Enter ASIN. The input accepts up to 10 identifiers; we use one at a time.
  const input = page.locator('input[placeholder*="keyword"], input[placeholder*="identifiers"]').first();
  await input.click();
  await input.fill('');
  await input.type(asin, { delay: 40 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Invalid-ASIN guard (Cerebro marks bad ASINs inline).
  if (await page.locator('text=Invalid ASIN').count()) {
    throw new Error(`Cerebro rejected ASIN ${asin} as invalid.`);
  }

  await page.locator('button:has-text("Get Keywords")').click();
  await page.waitForTimeout(3000);

  // Dismiss the "You've searched this product before" modal — run fresh data.
  const newSearch = page.locator('button:has-text("Run New Search")');
  if (await newSearch.count()) {
    await newSearch.first().click();
    log.info(`Cerebro ${asin}: dismissed history modal, running a new search.`);
  }

  // The results table is virtualized, so export the full keyword list as CSV
  // (the "Export Data…" control appears once results load) and parse it.
  await page.locator('text=/Export Data/i').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(2500);
  await page.locator('text=/Export Data/i').first().click();
  await page.waitForTimeout(1200);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.locator('text=/csv/i').first().click(),
  ]);
  const csv = readFileSync(await download.path(), 'utf8');
  const { header, rows: csvRows } = parseCsv(csv);
  const idx = {};
  header.forEach((h, i) => { idx[h.trim()] = i; });
  const get = (r, name) => r[idx[name]];
  const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };

  const all = csvRows.map((r) => ({
    keyword: (get(r, 'Keyword Phrase') ?? '').trim(),
    cerebroIq: num(get(r, 'Cerebro IQ Score')),
    searchVolume: num(get(r, 'Search Volume')),
    searchVolumeTrend: num(get(r, 'Search Volume Trend')),
    suggestedBid: get(r, 'H10 PPC Sugg. Bid') ? num(get(r, 'H10 PPC Sugg. Bid')) : null,
    competingProducts: String(get(r, 'Competing Products') ?? ''),
    cpr: num(get(r, 'CPR')) || null,
    titleDensity: num(get(r, 'Title Density')),
    organicRank: num(get(r, 'Organic Rank')),
  }));

  // Filters (applied in code): volume floor + organic-rank strike zone.
  const filtered = all
    .filter((r) => r.keyword)
    .filter((r) => r.searchVolume >= minSearchVolume)
    .filter((r) => r.organicRank >= rankMin && r.organicRank <= rankMax)
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, maxKeywords);

  log.info(`Cerebro ${asin}: ${all.length} keywords exported, ${filtered.length} after filters (vol>=${minSearchVolume}, rank ${rankMin}-${rankMax}).`);
  return filtered;
}

/** Minimal CSV parser handling quoted fields, escaped quotes, and BOM. */
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((f) => f !== ''));
  return { header: nonEmpty[0] ?? [], rows: nonEmpty.slice(1) };
}

async function fillFilter(page, label, indexWithinGroup, value) {
  // Each filter group: a label followed by Min/Max inputs.
  const group = page.locator(`div:has(> div:text-is("${label}"))`).first();
  const inputs = group.locator('input');
  const target = inputs.nth(indexWithinGroup);
  if (await target.count()) {
    await target.click();
    await target.fill(value);
    return;
  }
  // Fallback: position-based — find label, then nearest inputs.
  const fallback = page
    .locator(`text=${label}`)
    .locator('xpath=following::input[position()<=2]')
    .nth(indexWithinGroup);
  await fallback.click();
  await fallback.fill(value);
}

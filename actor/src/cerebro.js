// Helium 10 Cerebro automation. Selectors verified against cerebro-new (June 2026).
import { Actor, log } from 'apify';

const CEREBRO_URL = 'https://members.helium10.com/cerebro';

/**
 * True if we land on Cerebro logged-in on a PAID plan; false if login needed.
 * If the login page is shown, waits up to loginWaitMinutes for a human to
 * complete login through Apify Live View, polling for success.
 */
const SIGNIN_URL = 'https://members.helium10.com/user/signin';

export async function ensureLoggedIn(page, { loginWaitMinutes = 10 } = {}) {
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

  // Pre-fill the signin form so the human only has to solve the reCAPTCHA and
  // click "Log In" in Live View. (H10 login is reCAPTCHA v2 — not scriptable.)
  const email = process.env.H10_EMAIL;
  const password = process.env.H10_PASSWORD;
  if (email && password) await prefillLogin(page, email, password);

  log.warning(
    'LOGIN NEEDED → open this run\'s "Live view" tab, solve the reCAPTCHA, and click "Log In". ' +
    (email && password ? 'Email/password are pre-filled. ' : 'No H10_EMAIL/H10_PASSWORD set. ') +
    `Waiting up to ${loginWaitMinutes} min…`
  );
  await Actor.setStatusMessage('NEEDS_LOGIN: open Live View, solve captcha, click Log In.').catch(() => {});

  const deadline = Date.now() + loginWaitMinutes * 60_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(5_000);
    const url = page.url();
    if (!/\/user\/signin/.test(url)) {
      // The human left the signin page (submitted successfully) — confirm Cerebro.
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
    log.info('Helium 10 credentials pre-filled — solve the captcha + click Log In in Live View.');
  } catch (e) {
    log.warning(`prefillLogin error: ${e?.message ?? e}`);
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
  await page.waitForSelector('div[class*="datacy-rowcerebro"]', { timeout: 60_000 });

  // Filters: volume + organic-rank strike zone, then Apply.
  const showFilters = page.locator('text=Show Filters');
  if (await showFilters.count()) await showFilters.click();
  await fillFilter(page, 'Search Volume', 0, String(minSearchVolume));
  await fillFilter(page, 'Organic Rank', 0, String(rankMin));
  await fillFilter(page, 'Organic Rank', 1, String(rankMax));
  await page.locator('button:has-text("Apply Filters")').click();
  await page.waitForTimeout(4000);

  // Sort by search volume descending (one click on the column header).
  await page.locator('text=Search Volume').last().click();
  await page.waitForTimeout(2500);

  // Bump rows-per-page to 100 (bottom-right selector) to minimize pagination.
  try {
    const rpp = page.locator('text=Rows per page:').locator('xpath=following::*[self::select or @role="combobox"][1]');
    await rpp.click({ timeout: 5000 });
    await page.locator('li:has-text("100"), option:has-text("100")').first().click({ timeout: 5000 });
    await page.waitForTimeout(2500);
  } catch { log.info('Rows-per-page selector not found — staying at default 50.'); }

  // Extract across pages until maxKeywords (default 150 in v2).
  // innerText lines: [0]=keyword [4]=IQ [5]=volume [6]=trend% [7]=bid
  // [9]=competing [10]=CPR [11]=title density [last]=organic rank.
  const rows = [];
  while (rows.length < maxKeywords) {
    const batch = await page.$$eval('div[class*="datacy-rowcerebro"]', (els) =>
      els.map((el) => {
        const t = el.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
        const num = (s) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0;
        const trend = (() => {
          const m = String(t[6] ?? '').match(/(-?\d+)%/);
          return m ? Number(m[1]) * (/[↓-]|-/.test(t[6]) && !t[6].startsWith('-') ? 1 : 1) : 0;
        })();
        const bid = (() => {
          const m = String(t[7] ?? '').match(/\$([\d.]+)/);
          return m ? Number(m[1]) : null;
        })();
        return {
          keyword: t[0],
          cerebroIq: num(t[4]),
          searchVolume: num(t[5]),
          searchVolumeTrend: String(t[6] ?? '').includes('-') ? -Math.abs(trend) : trend,
          suggestedBid: bid,
          competingProducts: t[9] ?? '',
          cpr: num(t[10]) || null,
          titleDensity: num(t[11]),
          organicRank: num(t[t.length - 1]),
        };
      })
    );
    rows.push(...batch);
    if (rows.length >= maxKeywords) break;

    // Next page (chevron at the pagination bar); stop if disabled/absent.
    const next = page.locator('[aria-label="Go to next page"], button:has(svg):right-of(:text("…"))').first();
    if (!(await next.count()) || (await next.isDisabled().catch(() => true))) break;
    await next.click();
    await page.waitForTimeout(3000);
  }

  log.info(`Cerebro ${asin}: ${rows.length} rows extracted (cap ${maxKeywords}).`);
  return rows.filter((r) => r.keyword).slice(0, maxKeywords);
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

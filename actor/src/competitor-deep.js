// Deep competitor intelligence: SERP share-of-voice + product-page X-ray.
import { topOrganicCompetitors } from './amazon.js';
import { parseCount } from './analysis.js';

/**
 * For one keyword: top-N organic competitors + page-level details + weakness score.
 * weakness 0–100: higher = more attackable (few reviews, weak rating, keyword
 * missing from title, thin images).
 */
export async function deepCompetitorAnalysis(page, keyword, { n = 5, maxPageVisits = 5 } = {}) {
  const serp = await topOrganicCompetitors(page, keyword, n);

  const detailed = [];
  for (const c of serp.slice(0, maxPageVisits)) {
    let details = {};
    try {
      details = await productPageXray(page, c.asin);
    } catch {
      details = { error: 'page_fetch_failed' };
    }
    const merged = { ...c, ...details };
    merged.keywordInTitle = includesPhrase(merged.title ?? '', keyword);
    merged.weakness = weaknessScore(merged, keyword);
    detailed.push(merged);
    await page.waitForTimeout(1500 + Math.random() * 1500); // polite pacing
  }

  return {
    keyword,
    competitors: detailed,
    shareOfVoice: shareOfVoice(detailed),
    attackTarget: detailed.slice().sort((a, b) => b.weakness - a.weakness)[0] ?? null,
  };
}

/** Visit a product page and extract listing-quality signals. */
export async function productPageXray(page, asin) {
  await page.goto(`https://www.amazon.com/dp/${asin}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return page.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
    const bullets = [...document.querySelectorAll('#feature-bullets li span')]
      .map((el) => el.textContent.trim()).filter(Boolean);
    const bsrMatch = document.body.innerText.match(/#([\d,]+)\s+in\s+([^\n(]+)/);
    return {
      fullTitle: text('#productTitle'),
      bullets: bullets.slice(0, 5),
      bsr: bsrMatch ? Number(bsrMatch[1].replace(/,/g, '')) : null,
      bsrCategory: bsrMatch ? bsrMatch[2].trim() : null,
      imageCount: document.querySelectorAll('#altImages li img').length || null,
      hasAplus: !!document.querySelector('#aplus, #aplus_feature_div .aplus-v2'),
      hasVideo: !!document.querySelector('#altImages .videoThumbnail, li.videoBlockIngress'),
      couponBadge: !!document.querySelector('.promoPriceBlockMessage, [id*="coupon"]'),
      answeredQuestions: text('#askATFLink span'),
    };
  });
}

/** 0–100, higher = easier to beat for this keyword. */
export function weaknessScore(c, keyword) {
  let score = 0;
  const reviews = parseCount(c.reviewCount);
  if (reviews < 100) score += 30; else if (reviews < 500) score += 20; else if (reviews < 2000) score += 10;
  const rating = Number(c.rating) || 5;
  if (rating < 4.0) score += 20; else if (rating < 4.4) score += 12; else if (rating < 4.6) score += 5;
  if (!includesPhrase(c.fullTitle ?? c.title ?? '', keyword)) score += 20; // not optimized for the phrase
  if ((c.imageCount ?? 7) < 6) score += 10;
  if (!c.hasAplus) score += 10;
  if (!c.hasVideo) score += 5;
  if (c.couponBadge) score -= 5; // actively defending with promos
  return Math.max(0, Math.min(100, score));
}

/** Which brands dominate the top-N organic slots. */
export function shareOfVoice(competitors) {
  const brands = {};
  for (const c of competitors) {
    const brand = (c.fullTitle ?? c.title ?? '').split(/[\s,–-]/)[0]?.toLowerCase() || 'unknown';
    brands[brand] = (brands[brand] ?? 0) + 1;
  }
  return Object.entries(brands)
    .map(([brand, slots]) => ({ brand, slots, pct: Math.round((slots / competitors.length) * 100) }))
    .sort((a, b) => b.slots - a.slots);
}

/** Loose phrase containment: all words of the keyword appear in the text. */
export function includesPhrase(text, keyword) {
  const t = text.toLowerCase();
  return keyword.toLowerCase().split(/\s+/).every((w) => t.includes(w));
}

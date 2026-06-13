// Amazon SERP: top-N organic (non-sponsored) results for a keyword.
export async function topOrganicCompetitors(page, keyword, n = 5) {
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  return page.evaluate((max) => {
    const out = [];
    for (const d of document.querySelectorAll('div[data-asin]')) {
      const asin = d.dataset.asin;
      if (!asin || out.some((o) => o.asin === asin)) continue;
      const sponsored = [...d.querySelectorAll('span')].some((s) => s.innerText === 'Sponsored');
      if (sponsored) continue;
      const h = d.querySelector('h2');
      if (!h) continue;
      out.push({
        asin,
        title: h.innerText.slice(0, 120),
        price: d.querySelector('.a-price .a-offscreen')?.innerText ?? null,
        rating:
          d.querySelector('[aria-label*="out of 5"]')
            ?.getAttribute('aria-label')
            ?.match(/^[\d.]+/)?.[0] ?? null,
        reviewCount:
          d.querySelector('a[aria-label*="ratings"], span.a-size-base.s-underline-text')
            ?.innerText?.replace(/[()]/g, '') ?? null,
      });
      if (out.length >= max) break;
    }
    return out;
  }, n);
}

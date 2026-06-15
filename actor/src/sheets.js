// Google Sheets sync via service account (share the sheet with the SA email).
// Model: current-view tabs (Keyword Database, To-Do, Competitor Analysis) are
// OVERWRITTEN each run; Monthly Tracking is APPENDED for rank history.
import { google } from 'googleapis';

const TAB_HEADERS = {
  'Keyword Database': ['Date', 'My ASIN', 'Keyword', 'Opportunity Score', 'Lifecycle', 'Search Volume', 'Organic Rank', 'Cerebro IQ', 'Title Density', 'Competing Products', 'Status', 'Class'],
  'Monthly Tracking': ['My ASIN', 'Keyword', 'Month', 'Organic Rank'],
  'To-Do': ['Date', 'My ASIN', 'Keyword', 'Action', 'Priority', 'Done'],
  'Competitor Analysis': ['Date', 'My ASIN', 'Keyword', 'Rank', 'Competitor ASIN', 'Listing Link', 'Title', 'Price', 'Rating', 'Review Count'],
};

export async function syncSheet({ runStartedAt, products }) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SHEET_ID) return;
  const spreadsheetId = process.env.SHEET_ID;

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureTabs(sheets, spreadsheetId);

  const date = runStartedAt.slice(0, 10);
  const month = date.slice(0, 7);

  const overwrite = (tab, rows) =>
    sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tab}!A:Z` }).then(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId, range: `${tab}!A1`, valueInputOption: 'USER_ENTERED',
        requestBody: { values: [TAB_HEADERS[tab], ...rows] },
      }));
  const append = (tab, rows) => rows.length && sheets.spreadsheets.values.append({
    spreadsheetId, range: `${tab}!A:Z`, valueInputOption: 'USER_ENTERED', requestBody: { values: rows },
  });

  // Keyword Database — current view (overwrite), sorted-by-score as supplied.
  const kd = products.flatMap((p) => p.scored.map((k) => [
    date, p.asin, k.keyword, k.score ?? '', k.state ?? '', k.searchVolume, k.organicRank,
    k.cerebroIq, k.titleDensity, k.competingProducts, k.isNew ? 'New' : 'Tracked',
    k.classification === 'high_opportunity' ? 'High opportunity' : '',
  ]));
  await overwrite('Keyword Database', kd);

  // Monthly Tracking — append week-over-week rank history.
  await append('Monthly Tracking', products.flatMap((p) =>
    p.scored.map((k) => [p.asin, k.keyword, month, k.organicRank])));

  // To-Do — current new finds (overwrite).
  await overwrite('To-Do', products.flatMap((p) => p.newKeywords.map((k) => [
    date, p.asin, k.keyword, k.todoAction, k.classification === 'high_opportunity' ? 'High' : 'Medium', 'No',
  ])));

  // Competitor Analysis — current (overwrite). Top-5 ASINs per analyzed keyword.
  await overwrite('Competitor Analysis', products.flatMap((p) =>
    p.competitorSets.flatMap((set) => set.competitors.map((c, i) => [
      date, p.asin, set.keyword, i + 1, c.asin, `https://www.amazon.com/dp/${c.asin}`,
      c.title, c.price, c.rating, c.reviewCount,
    ]))));
}

/** Create any missing tabs (with a header row) so writes land cleanly. */
async function ensureTabs(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets || []).map((s) => s.properties.title));
  const toAdd = Object.keys(TAB_HEADERS).filter((t) => !existing.has(t));
  if (!toAdd.length) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) },
  });
  for (const title of toAdd) {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${title}!A1`, valueInputOption: 'RAW',
      requestBody: { values: [TAB_HEADERS[title]] },
    });
  }
}

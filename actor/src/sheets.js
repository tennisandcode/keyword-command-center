// Google Sheets sync via service account (share the sheet with the SA email).
// Appends to: Keyword Database, Monthly Tracking, To-Do, Competitor Analysis.
import { google } from 'googleapis';

export async function syncSheet({ asin, kept, newKept = kept, competitorSets, runStartedAt }) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SHEET_ID) return;

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureTabs(sheets, process.env.SHEET_ID);
  const date = runStartedAt.slice(0, 10);
  const append = (range, values) =>
    sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

  // All scored keywords this run → Keyword Database + Monthly Tracking (rank history).
  if (kept.length) {
    await append('Keyword Database!A:L', kept.map((k) => [
      date, asin, k.keyword, k.score ?? '', k.state ?? '', k.searchVolume, k.organicRank,
      k.cerebroIq, k.titleDensity, k.competingProducts, k.isNew ? 'New' : 'Tracked',
      k.classification === 'high_opportunity' ? 'High opportunity' : '',
    ]));
    const month = date.slice(0, 7);
    await append('Monthly Tracking!A:D', kept.map((k) => [asin, k.keyword, month, k.organicRank]));
  }

  // Only newly-discovered keywords → To-Do (so it doesn't pile up every run).
  if (newKept.length) {
    await append('To-Do!A:F', newKept.map((k) => [
      date, asin, k.keyword, k.todoAction,
      k.classification === 'high_opportunity' ? 'High' : 'Medium', 'No',
    ]));
  }

  const compRows = competitorSets.flatMap((set) =>
    set.competitors.map((c, i) => [
      date, asin, set.keyword, i + 1, c.asin,
      `https://www.amazon.com/dp/${c.asin}`, // listing link (clickable in Sheets)
      c.title, c.price, c.rating, c.reviewCount,
    ])
  );
  if (compRows.length) await append('Competitor Analysis!A:J', compRows);
}

const TAB_HEADERS = {
  'Keyword Database': ['Date', 'My ASIN', 'Keyword', 'Opportunity Score', 'Lifecycle', 'Search Volume', 'Organic Rank', 'Cerebro IQ', 'Title Density', 'Competing Products', 'Status', 'Class'],
  'Monthly Tracking': ['My ASIN', 'Keyword', 'Month', 'Organic Rank'],
  'To-Do': ['Date', 'My ASIN', 'Keyword', 'Action', 'Priority', 'Done'],
  'Competitor Analysis': ['Date', 'My ASIN', 'Keyword', 'Rank', 'Competitor ASIN', 'Listing Link', 'Title', 'Price', 'Rating', 'Review Count'],
};

/** Create any missing tabs (with a header row) so appends land cleanly. */
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

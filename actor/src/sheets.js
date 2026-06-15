// Google Sheets sync via service account (share the sheet with the SA email).
// Appends to: Keyword Database, Monthly Tracking, To-Do, Competitor Analysis.
import { google } from 'googleapis';

export async function syncSheet({ asin, kept, competitorSets, runStartedAt }) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SHEET_ID) return;

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureTabs(sheets, process.env.SHEET_ID, ['Keyword Database', 'Monthly Tracking', 'To-Do', 'Competitor Analysis']);
  const date = runStartedAt.slice(0, 10);
  const append = (range, values) =>
    sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

  if (kept.length) {
    await append('Keyword Database!A:I', kept.map((k) => [
      date, asin, k.keyword, k.searchVolume, k.organicRank, k.cerebroIq,
      k.titleDensity, 'New', k.classification === 'high_opportunity' ? 'High opportunity' : '',
    ]));
    await append('To-Do!A:F', kept.map((k) => [
      date, asin, k.keyword, k.todoAction,
      k.classification === 'high_opportunity' ? 'High' : 'Medium', 'No',
    ]));
    // Monthly Tracking: long format (keyword, month, rank) — pivot in the
    // sheet or Looker Studio; avoids brittle column management.
    const month = date.slice(0, 7);
    await append('Monthly Tracking!A:D', kept.map((k) => [asin, k.keyword, month, k.organicRank]));
  }

  const compRows = competitorSets.flatMap((set) =>
    set.competitors.map((c, i) => [
      date, asin, set.keyword, i + 1, c.asin, c.title, c.price, c.rating, c.reviewCount,
    ])
  );
  if (compRows.length) await append('Competitor Analysis!A:I', compRows);
}

/** Create any missing tabs so appends don't fail on a blank spreadsheet. */
async function ensureTabs(sheets, spreadsheetId, tabs) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets || []).map((s) => s.properties.title));
  const toAdd = tabs.filter((t) => !existing.has(t));
  if (toAdd.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) },
    });
  }
}

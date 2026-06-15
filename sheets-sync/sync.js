// Keyless Sheets sync: pulls keyword data from the portal API and writes it to
// the Google Sheet. Authenticates to Sheets via Application Default Credentials
// — i.e. the attached service account (kcc-sheets) on Cloud Functions / Cloud
// Run / GCE. No downloaded key.
const { google } = require('googleapis');

async function runSync() {
  const { PORTAL_URL, PORTAL_API_TOKEN, SHEET_ID } = process.env;
  if (!PORTAL_URL || !PORTAL_API_TOKEN || !SHEET_ID) {
    throw new Error('Missing env vars: PORTAL_URL, PORTAL_API_TOKEN, SHEET_ID');
  }

  // 1. Pull current keyword insights from the portal.
  const res = await fetch(`${PORTAL_URL}/api/insights`, {
    headers: { authorization: `Bearer ${PORTAL_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Portal ${res.status}: ${await res.text()}`);
  const { insights = [] } = await res.json();

  // 2. Auth to Sheets via ADC (the attached service account — no key file).
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 3. Ensure the "Keywords" tab exists.
  const tab = 'Keywords';
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  if (!meta.data.sheets.some((s) => s.properties.title === tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }

  // 4. Overwrite the tab with the current snapshot.
  const header = ['ASIN', 'Keyword', 'Classification', 'Status', 'Current Rank', 'Weekly Δ', 'Search Volume', 'Open To-Dos'];
  const rows = insights.map((i) => [
    i.asin, i.keyword, i.classification, i.status,
    i.currentRank ?? '', i.weeklyDelta ?? '', i.volume ?? '', i.openTodos ?? 0,
  ]);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${tab}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [header, ...rows] },
  });

  return { written: rows.length };
}

module.exports = { runSync };

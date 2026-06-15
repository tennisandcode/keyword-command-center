// HTTP entry point for Cloud Functions (gen2) and Cloud Run.
const functions = require('@google-cloud/functions-framework');
const { runSync } = require('./sync');

functions.http('syncSheets', async (req, res) => {
  try {
    const result = await runSync();
    console.log('synced', result);
    res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

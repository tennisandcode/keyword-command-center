// CLI entry point for a GCE VM cron job.
const { runSync } = require('./sync');
runSync()
  .then((r) => { console.log('synced', r); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });

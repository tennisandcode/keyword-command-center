// Postgres persistence (portal's database). Optional: returns null without DATABASE_URL.
import pg from 'pg';

export async function connect() {
  if (!process.env.DATABASE_URL) return null;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

/** Rank history per keyword for an ASIN: { keyword: [{date, organicRank}, …] } oldest-first. */
export async function rankHistories(client, asin) {
  const { rows } = await client.query(
    `SELECT k.keyword, r.started_at AS date, s.organic_rank
     FROM keyword_snapshots s
     JOIN keywords k ON k.id = s.keyword_id
     JOIN runs r ON r.id = s.run_id
     WHERE k.asin = $1 ORDER BY r.started_at ASC`,
    [asin]
  );
  const map = {};
  for (const r of rows) {
    (map[r.keyword] ??= []).push({ date: r.date, organicRank: r.organic_rank });
  }
  return map;
}

/** Completed to-dos with timestamps — feeds the learning loop. */
export async function actionedTodos(client, asin) {
  const { rows } = await client.query(
    `SELECT k.keyword, t.action, t.created_at AS "completedAt"
     FROM todos t JOIN keywords k ON k.id = t.keyword_id
     WHERE k.asin = $1 AND t.done = true`,
    [asin]
  );
  return rows;
}

export async function knownKeywords(client, asin) {
  const { rows } = await client.query(
    'SELECT lower(keyword) AS k FROM keywords WHERE asin = $1',
    [asin]
  );
  return new Set(rows.map((r) => r.k));
}

export async function persistRun(client, { asin, runStartedAt, kept, competitorSets }) {
  const { rows: [run] } = await client.query(
    'INSERT INTO runs (asin, started_at) VALUES ($1, $2) RETURNING id',
    [asin, runStartedAt]
  );

  for (const k of kept) {
    const { rows: [kw] } = await client.query(
      `INSERT INTO keywords (asin, keyword, classification, status)
       VALUES ($1, $2, $3, 'new')
       ON CONFLICT (asin, keyword) DO UPDATE SET classification = EXCLUDED.classification
       RETURNING id`,
      [asin, k.keyword, k.classification]
    );
    await client.query(
      `INSERT INTO keyword_snapshots (keyword_id, run_id, search_volume, organic_rank, cerebro_iq, title_density)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [kw.id, run.id, k.searchVolume, k.organicRank, k.cerebroIq, k.titleDensity]
    );
    await client.query(
      `INSERT INTO todos (keyword_id, action, priority)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [kw.id, k.todoAction, k.classification === 'high_opportunity' ? 'high' : 'medium']
    );
  }

  for (const set of competitorSets) {
    for (const [i, c] of set.competitors.entries()) {
      await client.query(
        `INSERT INTO competitors (run_id, keyword, position, asin, title, price, rating, review_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [run.id, set.keyword, i + 1, c.asin, c.title, c.price, c.rating, c.reviewCount]
      );
    }
  }
}

/** All ranked keywords for an ASIN — overwritten each run (current view). Self-creates
 *  its table so it works even before the portal's prisma db push. */
export async function persistRanked(client, { asin, runStartedAt, ranked }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ranked_keywords (
      id SERIAL PRIMARY KEY,
      asin TEXT NOT NULL,
      keyword TEXT NOT NULL,
      organic_rank INTEGER NOT NULL,
      search_volume INTEGER NOT NULL,
      cerebro_iq INTEGER,
      title_density INTEGER,
      competing TEXT,
      captured_at TIMESTAMP NOT NULL,
      UNIQUE (asin, keyword)
    )`);
  await client.query('DELETE FROM ranked_keywords WHERE asin = $1', [asin]);
  for (let i = 0; i < ranked.length; i += 500) {
    const chunk = ranked.slice(i, i + 500);
    const values = [];
    const params = [];
    chunk.forEach((r, j) => {
      const b = j * 8;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`);
      params.push(asin, r.keyword, r.organicRank, r.searchVolume, r.cerebroIq ?? null, r.titleDensity ?? null, String(r.competingProducts ?? ''), runStartedAt);
    });
    await client.query(
      `INSERT INTO ranked_keywords (asin, keyword, organic_rank, search_volume, cerebro_iq, title_density, competing, captured_at)
       VALUES ${values.join(',')} ON CONFLICT (asin, keyword) DO NOTHING`,
      params
    );
  }
}

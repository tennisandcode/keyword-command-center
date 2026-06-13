# Keyword Command Center

Automated Amazon keyword research for BlackVoyage: Helium 10 Cerebro → keyword
database → competitor analysis → Google Sheets + web portal with dashboard,
run history, and ranking to-dos.

```
┌──────────────┐   Run Now / Mon cron   ┌─────────────────────┐
│  Portal       │ ─────────────────────▶ │  Apify actor        │
│  (Render)     │ ◀───── webhook ─────── │  (Playwright)       │
│  Next.js + PG │                        │  H10 Cerebro +      │
└──────┬───────┘                        │  Amazon SERP        │
       │ dashboards, to-dos             └──────┬──────────────┘
       ▼                                       │ writes
  You (browser)                    Postgres + Google Sheets
```

**Login handoff:** credentials are never stored. The actor reuses saved H10
session cookies; when they expire it pauses on the login page and you sign in
through the Apify run's **Live View** tab. Cookies are then saved to a named
key-value store (`h10-session`) for future unattended runs.

## 1. Deploy the actor (Apify)

```bash
npm i -g apify-cli
cd actor && npm install
apify login                 # one-time
apify push                  # creates the actor in your Apify account
```

Actor → Settings → Environment variables:

| Var | Value |
| --- | --- |
| `DATABASE_URL` | Render Postgres external URL (optional — omit for Sheets-only) |
| `SHEET_ID` | Google Sheet ID (from its URL) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | full JSON key of a service account with Sheets API enabled; share the Sheet with the SA's email |
| `PORTAL_URL` | https://your-portal.onrender.com (optional) |
| `PORTAL_API_TOKEN` | any long random string (same value in the portal) |

Schedule: Apify Console → Schedules → new schedule `@weekly` (Mon 08:00, your TZ) → run this actor with empty input (it pulls active ASINs from the portal).

**First run:** start it manually from the portal or Apify Console, open the
run's **Live View** tab, log into Helium 10 (Remember Me checked) within the
10-minute window. Subsequent runs reuse the session.

## 2. Deploy the portal (Render)

1. Push this repo to GitHub.
2. Render → New → PostgreSQL (free tier is fine). Copy the internal URL.
3. Render → New → Web Service → repo root `portal/`:
   - Build: `npm install && npm run db:push && npm run build`
   - Start: `npm start`
   - Env vars: `DATABASE_URL`, `APIFY_TOKEN`, `APIFY_ACTOR_ID`
     (e.g. `youruser~h10-keyword-finder`), `PORTAL_API_TOKEN`,
     `NEXT_PUBLIC_PORTAL_API_TOKEN` (same value), optional `RESEND_API_KEY`
     + `DIGEST_EMAIL` for the post-run email digest.
4. Seed your products:

```bash
curl -X POST https://your-portal.onrender.com/api/products \
  -H "authorization: Bearer $PORTAL_API_TOKEN" -H "content-type: application/json" \
  -d '{"asin":"B0DDQL7PVM","title":"Vortex Vacuum Seal Travel Backpack 60L"}'
```

## 3. Google Sheet

Use the existing "Black Voyage – Keyword Command Center" or any sheet with tabs:
`Keyword Database`, `Monthly Tracking`, `To-Do`, `Competitor Analysis`.
Add an `ASIN` column (the actor writes one row layout for all products).
Share the sheet with the service-account email (Editor).

## Notes & caveats

- **Helium 10 ToS**: there is no public H10 API; browser automation of a paid
  account is not officially sanctioned. The attended-login design avoids
  credential storage and CAPTCHA automation, but use judgment on frequency
  (weekly is conservative).
- **Phase 2 (recommended)**: add Amazon SP-API *Search Query Performance*
  reports as an official, free data backbone; keep Cerebro for discovery.
- If H10 blocks datacenter IPs, enable an Apify **residential proxy** group on
  the actor (Input → Proxy).
- Portal auth is a single shared token — put the service behind Render's
  built-in password protection or add real auth before sharing the URL.

## Costs

| Item | Monthly |
| --- | --- |
| Apify (Starter, includes scheduling) | $0–49 |
| Render web service + Postgres | $7–14 |
| Resend email | $0 |
| Looker Studio (optional dashboards on the Sheet) | $0 |

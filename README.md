# KNPL-7 Fixture Centre

Static site (GitHub Pages) + optional Google Apps Script backend.

## Files
index.html, app.js, engine.js, thumb.js, config.js, assets/knpl_logo.png, Code.gs (backend)

## 1. Try it now (demo mode)
Open through any web server (not file://, canvas download needs it): `python3 -m http.server` then http://localhost:8000
Login: any name, 10-digit mobile, code `knpl7` (config.js DEMO_COMMITTEE_CODE). Data stays in that browser.

## 2. Go live
1. New Google Sheet > Extensions > Apps Script > paste Code.gs.
2. Project Settings > Script properties: COMMITTEE_CODE (your secret code), COMMITTEE_MOBILES (comma-separated 10-digit numbers, optional), SPONSOR_SHEET_ID (sponsorship portal sheet).
3. Deploy > New deployment > Web app > Execute as Me, Access Anyone. Copy the /exec URL into config.js API_URL.
4. Remove DEMO_COMMITTEE_CODE from config.js. Push all files to the knplseason7 GitHub Pages repo.

## 3. Event workflow
Draw groups (wheel) > Round 1 lot per group > Generate Group A R1 > create the 4 matches in CricHeroes > tick "Created in CricHeroes" (this unlocks thumbnails and the YouTube page) > after scoring, Fetch / import results > Generate next round. Links for YouTube team and owners are on "Downloads & links".

## Known limits
* CricHeroes cannot be written to from here. Fetch is experimental; CSV import is the guaranteed fallback.
* Owner codes and state are stored in the Sheet; the public endpoint returns the full state. Treat the team page as convenience-level security.
* Tie-break after points and NRR is a placeholder (team code). Confirm the rule.

## Simulation and ground-change check
The Simulation tab is a sandbox (never touches real data): random or manual results, full tournaments, and a batch summary of how often a team changes ground twice in a day. The same "Ground-change check" table appears on the live Fixture tab.
Timings: 7:30 start, 85 min matches (Day 3: 80 min), 15 min between rounds, 30 min ground-change buffer, latest finish 18:00 (no floodlights). The ground-change limit for the whole tournament is a setting (default 5).
Points table tab: paste the CricHeroes order for a group to make the next round follow CricHeroes exactly (valid until the next result is entered).

## Ground-change policy (engine)
Ladder pairings are untouched. Ground choice minimises total changes (limit setting, default 12), always keeps a 30 minute buffer, finishes by 18:00, and when a cross-ground match forces one team to travel it prefers the lower-ranked team (the higher-ranked or winning side stays).

The 30 minute buffer is added only when a team actually travels (the next round is generated after results, so travel is known then). The Grand Final is always at the first ground (FISAT); the 45 minute break after the semi-finals covers any finalist travelling.

## Phases and multi-user use
* Before 30 Nov: the practice simulation page (`#/sim`) lets anyone generate their own groups and run the whole ladder, Round 1 to Final, with fixtures, random or picked results, thumbnails (sponsors shown as "yet to be finalised" until you tick "Sponsors finalised"), and a Reset button.
* 30 Nov: committee draws groups on the Draw tab and clicks **Freeze groups**. From then on every practice simulation starts from the frozen groups.
* When the CricHeroes tournament is live (by 10 Jan): add the link in Settings and click **Mark tournament started**. Results then come from **Fetch CricHeroes results** (manual entry stays as a fallback).
* The practice simulation runs entirely in each visitor's browser and is saved only on their device, so any number of people can use it at the same time without affecting each other or the server.
* Live committee data is protected against two people saving at once (version check + lock in Code.gs): the second save is refused and the page reloads the latest data. Owner codes are checked on the server and never sent to public pages.

## Pages
* `/` Home (share this link with everyone), `#/learn` How it works, `#/sim` practice simulation, `#/team` franchise owners, `#/yt` YouTube team.
* Committee tools: `#/admin` (name and mobile only until an access code is created in Settings).

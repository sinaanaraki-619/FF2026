# Draft Compass

A dependency-free, static fantasy football draft dashboard for GitHub Pages. It calculates snake-draft picks, swaps PPR and half-PPR boards, uses source-weighted ADP, and creates a 12-round queue with alternatives and risk labels.

## Run locally

No install or build is required. From the repository root, start a static server:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`. Do not open `index.html` directly: using a server matches GitHub Pages behavior.

Validate the Yahoo-primary ADP aggregation and the checked multi-source player values:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-adp.ps1
```

## Publish with GitHub Pages

1. Push the default branch (`main`) containing this repository.
2. In the GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. The included `.github/workflows/pages.yml` deploys every push to `main`; use the workflow's environment URL after its first successful run.

The workflow intentionally has no package-install or build steps because the site is plain HTML, CSS, and JavaScript.

## Data model and refresh workflow

`assets/data.js` is the runtime data file. It keeps:

- source metadata and per-source timestamps for Yahoo (primary), Sleeper, RTSports, and Real-Time;
- distinct `rankings.ppr` and `rankings.halfPpr` boards;
- player identity, rank, tier, projected points, and an ADP value for each source.

The bundled data is an **illustrative local seed**, not a claim of live rankings. The PPR and half-PPR boards are intentionally separate. Until a dedicated half-PPR export is loaded, the app visibly marks that board as provisional.

Use `data/source-schema.json` as the contract when replacing the sample values. A dependency-free CSV normalizer is included for a Fantasy Guru-style top-200 export:

```powershell
node scripts/import-rankings.mjs .\downloads\fantasy-guru-ppr.csv .\data\ppr-import.json ppr
node scripts/import-rankings.mjs .\downloads\half-ppr.csv .\data\half-ppr-import.json halfPpr
```

The importer requires `rank` (or `overall rank`), `player` (or `name`), and `position` (or `pos`) columns. It accepts optional `team` and `adp` columns. Review the generated JSON, then update the matching board in `assets/data.js`, merge the current Yahoo/Sleeper/RTSports/Real-Time ADPs, and set:

1. `meta.dataLastRefreshed` to the refresh time.
2. Every source's `refreshedAt` timestamp.
3. `meta.isSampleData` to `false`.
4. `rankings.halfPpr.provisional` to `false` only after importing a true half-PPR source.

Yahoo is intentionally the primary source (55% default weight). The remaining sources identify market disagreement and contribute 45% combined. Adjust source weights only if the target draft room reliably follows a different market.

The board displays Yahoo ADP, the secondary-source consensus (Sleeper, RTSports, and Real-Time normalized to their combined weight), and Target ADP. Target ADP is a 55% Yahoo / 45% secondary-consensus weighted average; values are never summed.

The HTML fingerprints its JavaScript asset URLs. When updating `assets/data.js` or `assets/app.js`, change the `v=` value in `index.html` so GitHub Pages clients load the new board instead of a cached script.

## Target logic

For each candidate, Draft Compass computes a source-weighted ADP and target window. Labels at a planned selection are:

| Situation | Label |
| --- | --- |
| 9+ picks after ADP | Major steal |
| 4–8 picks early (preferred) or 4–8 picks late | High priority |
| 0–3 picks early | Fair |
| 9–12 picks early | High priority only for tier 1–2 large-value cases |
| More than 12 picks early, or a 9–12 early reach without a large-value case | Avoid |

The guardrail never recommends a player more than 12 picks early.

Queue recommendations also have an availability gate. Yahoo ADP is checked first against a weighted consensus of Sleeper, RTSports, and Real-Time. A player is excluded when **both** Yahoo and consensus are more than half a draft round earlier than the planned pick (5 picks in 10-team leagues, 6 in 12-team leagues, and 7 in 14-team leagues). This keeps implausibly expired players out of both primary and alternate targets while still allowing realistic falls. If the local board has no eligible player left, the relevant round explains that more current rankings are needed.

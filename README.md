# Draft Compass

A dependency-free, static fantasy football draft dashboard for GitHub Pages. It calculates snake-draft picks, swaps PPR and half-PPR boards, uses source-weighted ADP, and creates a 15-round queue with alternatives and risk labels.

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

Validate the full 15-round queue across every scoring, league-size, draft-slot, and flex combination:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-fifteen-round-queue.ps1
```

## Publish with GitHub Pages

1. Push the default branch (`main`) containing this repository.
2. In the GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. The included `.github/workflows/static.yml` deploys every push to the published branch and `main`; use the workflow's environment URL after its first successful run.

The workflow intentionally has no package-install or build steps because the site is plain HTML, CSS, and JavaScript.

## Data model and refresh workflow

`assets/data.js` is the runtime data file. It keeps:

- source metadata and per-source timestamps for Yahoo (primary), Sleeper, RTSports, and Real-Time;
- distinct `rankings.ppr` and `rankings.halfPpr` boards;
- player identity, rank, tier, projected points, and an ADP value for each source.

The bundled PPR board is generated from the supplied Fantasy Guru top-200 export and the supplemental Yahoo/Sleeper/RTSports/AVG/Real-Time table. The half-PPR board remains intentionally separate but provisional because a dedicated half-PPR ranking export was not supplied.

Use `data/source-schema.json` as the contract when replacing source values. To rebuild the runtime data from a Guru CSV and repeating supplemental ADP table:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\rebuild-source-data.ps1 `
  -GuruCsvPath .\downloads\fantasy-guru-ppr.csv `
  -SupplementalAdpPath .\downloads\platform-adp.txt
```

The rebuild script uses normalized player-name joins, strips source position ordinals (for example `RB5` to `RB`), rejects duplicate identities, and stops on unexpected missing joins. The supplied source has no supplemental match for `Bryce Lance` or Carolina Panthers; they are deliberately excluded and recorded in `meta.excludedGuruRecords`.

1. `meta.dataLastRefreshed` to the refresh time.
2. Every source's `refreshedAt` timestamp.
3. `meta.isSampleData` to `false`.
4. `rankings.halfPpr.provisional` to `false` only after importing a true half-PPR source.

Yahoo is intentionally the primary target input (55% default weight). The supplied `AVG` value is the source consensus of Yahoo, Sleeper, and RTSports; Real-Time remains a separate comparison field. Adjust source weights only if the target draft room reliably follows a different market.

The board displays Yahoo ADP, the supplied source consensus (`AVG`), and Target ADP. Target ADP is a 55% Yahoo / 45% source-consensus weighted average; values are never summed or independently recomputed from a shifted column.

The HTML fingerprints its JavaScript asset URLs. When updating `assets/data.js` or `assets/app.js`, change the `v=` value in `index.html` so GitHub Pages clients load the new board instead of a cached script.

## DraftSharks consensus snapshots

DraftSharks is optional comparison data and **does not overwrite** the local Yahoo-primary/Guru-backed board. The dashboard always provides an **Open DraftSharks source** link for the selected scoring and league size:

- PPR: `https://www.draftsharks.com/adp/ppr/consensus/{10|12|14}`
- Half-PPR: `https://www.draftsharks.com/adp/half-ppr/consensus/{10|12|14}`

To attempt a saved snapshot refresh:

1. Set scoring and league size in the dashboard.
2. Select **Refresh DraftSharks ADP**.
3. In GitHub Actions, select **Run workflow**, choose the same `scoring` and `teams` inputs, and start it on the published branch.
4. A successful run commits only `data/draftsharks-snapshots.json`, which GitHub Pages then deploys. The dashboard displays its saved timestamp, filter, and record count.

The workflow uses the public page only, checks its response for a stable table containing at least 20 unique player/ADP rows, and commits nothing if that validation fails. It writes an Actions summary and downloadable report explaining the failure, while preserving all dashboard rankings. DraftSharks can render dynamic or protected markup, so a failed workflow is expected behavior—not a partial import. In that case, use the selected source link and retain/export a permitted table for manual review before updating local source data.

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

Queue recommendations also have an availability gate. Yahoo ADP is checked first against the supplied source `AVG`. A player is excluded when **both** Yahoo and consensus are more than half a draft round earlier than the planned pick (5 picks in 10-team leagues, 6 in 12-team leagues, and 7 in 14-team leagues). This keeps implausibly expired players out of both primary and alternate targets while still allowing realistic falls. If the local board has no eligible player left, the relevant round explains that more current rankings are needed.

The cheat sheet maps exactly 15 snake-draft rounds. Rounds 13–15 prioritize RB/WR depth first, with TE and QB contingency options; the selected position path, Yahoo/AVG availability gate, and risk labels continue to apply through the final round.

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

Validate the deterministic ADP availability boundaries and source-backed Wan'Dale capture case:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-adp-availability.ps1
```

Validate matching DraftSharks snapshot overrides and the local fallback:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-draftsharks-consensus.ps1
```

Validate the Pacific schedule guard and source timestamp parser:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-draftsharks-schedule.ps1
```

Validate the league scoring, projection joins, VORP baseline, positional tiers, and two-flex allocation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-league-projections.ps1
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

DraftSharks is optional market data. A validated snapshot that exactly matches the selected scoring and league size replaces **consensus ADP only** for players it contains. Yahoo remains the 55% primary target input, and the Fantasy Guru-backed rank, tier, and positional strategy never change. A player absent from a matching snapshot falls back to the supplied local `AVG`.

The dashboard has a prominent **ADP freshness and source status** panel for the selected filters. It shows the local snapshot refresh time, exact public source URL/filter, and the DraftSharks page's own last-updated time only when the validated public response supplied a labeled, timezone-qualified timestamp. Otherwise it says the source timestamp is unavailable. The half-PPR ranking baseline remains provisional/full-PPR-derived even when a matching half-PPR DraftSharks snapshot provides market ADP.

The dashboard always provides an **Open DraftSharks source** link for the selected scoring and league size:

- PPR: `https://www.draftsharks.com/adp/ppr/consensus/{10|12|14}`
- Half-PPR: `https://www.draftsharks.com/adp/half-ppr/consensus/{10|12|14}`

There is no dashboard refresh button. The workflow schedules two UTC candidates, `0 15 * * *` and `0 16 * * *`; `scripts/draftsharks-schedule-guard.py` uses the IANA `America/Los_Angeles` timezone to allow only the candidate that falls in the 8 AM Pacific hour. This handles PDT/PST transitions without running twice. The allowed run attempts PPR and half-PPR for 10, 12, and 14 teams; `workflow_dispatch` remains available to repository maintainers for an out-of-band all-filter attempt.

The workflow uses the public page only and does not bypass access controls. Each filter must expose a stable public table with at least 20 unique player/ADP rows before its snapshot is changed. Failed, dynamic, or blocked responses leave an existing valid snapshot untouched; valid changed snapshots are committed and Pages deploys them. The Actions summary and artifact list every filter outcome. DraftSharks has previously served dynamic or protected markup in this environment, so an unavailable source is expected to remain an explicit status, not a partial import or invented timestamp.

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

Queue recommendations use an **estimated availability model**, not a hard Yahoo/consensus cutoff. Target ADP is treated as the center of a normal selection range. Its deterministic spread is:

`min(30, 1.75 + Target ADP × 0.075 + |Yahoo ADP − consensus ADP| × 0.35)` picks.

The displayed **Available at this pick** value is the upper-tail probability that the player's modeled selection has not occurred before that pick. A candidate is suppressed only below an explicit 8% availability threshold, preventing obvious long shots such as ADP 1 at pick 5 while allowing an ADP near 100 to remain plausible around pick 105. The uncertainty model deliberately gets broader later in drafts and with greater platform disagreement; it is a repeatable decision aid, not a claim of empirical draft-outcome precision.

**Next-pick survival** is the conditional probability of still being available at the manager's following snake pick, given availability now. **Take Now** captures a player with low survival or a material Guru-rank-versus-market gap; **Safe to Wait** indicates adequate conditional survival; **Value if Falls** identifies a lower-probability option that should not drive a reach. The rank-versus-market gap can make a controlled 9–12-pick reach actionable for a large-value capture, but the dashboard still never recommends more than 12 picks early.

The cheat sheet maps exactly 15 snake-draft rounds. Rounds 13–15 prioritize RB/WR depth first, with TE and QB contingency options; the selected position path, active-consensus availability model, and risk labels continue to apply through the final round.

## Live Draft and Mock Draft

Use the **Mode** selector for three offline modes:

- **Cheat Sheet** keeps the existing source-backed queue.
- **Live Draft** lets you click available players into the current snake pick, or assign a manual correction to a selected team. It stores that pick list only in browser `localStorage`, keyed by scoring format, league size, draft slot, and flex count. Undo removes the latest pick; Reset asks for confirmation and clears that local draft.
- **Mock Draft** reserves your snake picks for manual clicks. **Play next AI pick** advances one opposing pick; **Auto-run to my pick** advances AI opponents until your next turn. **New mock** resets the deterministic seed. AI is a practice heuristic, not a forecast of real managers: it weights ADP proximity, Guru rank/value, position need, tier drop, and the configurable reach-tolerance slider, while never selecting an already drafted player.

The draft room is a responsive three-pane analyzer: the left pane filters the available player pool by name, position, or roster need; the center pane keeps the live snake board and current pick visible; and the right pane highlights the recommended target, rationale, alternatives, starter/flex construction, and your roster. The recommendation is always evaluated against **your** roster, including while a mock manager is on the clock; the mock AI separately evaluates the roster of the team making its own selection.

The live conditional survival figure starts from the ADP survival model, then applies roster/game-theory pressure for the teams drafting before your next pick:

`adjusted = baseline × (1 - 0.32 × position-need rate - 0.12 × same-tier run rate) + 0.12 × (1 - baseline)` when no intervening team needs that position, capped at 97%.

It is explicitly a **model estimate**, not certainty. For example, when all intervening teams already have a QB, QB survival rises above baseline but is never stated as guaranteed. The priority panel turns this estimate, roster need, positional tier drop, ADP value, and VORP where available into a target plus three alternatives and **Take Now**, **Wait**, or **Pivot** guidance.

Validate interactive-draft logic:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-interactive-draft.ps1
```

## Custom 12-team league model

The dashboard exposes two exact 12-team formats:

- **Custom half-PPR:** 0.5 points per reception.
- **Custom full PPR:** 1.0 point per reception.

Both formats use 1 QB, 2 RB, 2 WR, 1 TE, 2 W/R/T flex, K, DEF, and 5 bench spots. The available-category scoring formula is:

`pass yards / 25 + pass TD × 6 - INT × 2 + rush yards / 10 + rush TD × 6 + receptions × format value + receiving yards / 10 + receiving TD × 6 - fumbles × 2`.

Full PPR is therefore exactly `half-PPR + 0.5 × projected receptions`. The supplied offensive projection CSV has no first-down fields, so the app does not fabricate passing/rushing/receiving first-down points. It also contains season totals rather than game-level projections, so 100/150/200 rushing/receiving and 350/400/450 passing bonuses cannot be calculated faithfully and are excluded. The UI calls out both limitations; there is no first-down proxy enabled by default or hidden in the totals.

`assets/projections.js` is generated from the supplied CSV:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-offensive-projections.ps1 `
  -ProjectionCsvPath .\downloads\NFL_Season_Projections__OFF_.csv
```

The supplied file contains 108 `QB` rows, of which 19 normalized player IDs match the 198-player draft board. Consequently, projected points and projection VORP are available only for those QBs. RB/WR/TE projection and VORP cells explicitly show **unavailable** rather than inferred values.

Replacement levels begin with 12 QB, 24 RB, 24 WR, and 12 TE required league-wide starters. The remaining two flex starters per team (24 total) are allocated from the next-best Guru-ranked RB/WR/TE pool after those required starters; the resulting position counts establish dynamic replacement indices. Positional tiers use six-player Guru-rank blocks and are labeled rank-derived, not projection tiers. Queue cards combine roster need (core/flex/depth), tier drop before the next snake pick, ADP survival probability, and VORP when it exists to recommend **Take Now**, **Wait**, or **Pivot**.

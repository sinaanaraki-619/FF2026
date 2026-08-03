param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$index = Get-Content -LiteralPath (Join-Path $RepositoryRoot "index.html") -Raw
$app = Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets\app.js") -Raw
$workflow = Get-Content -LiteralPath (Join-Path $RepositoryRoot ".github\workflows\refresh-draftsharks-adp.yml") -Raw
$refreshScript = Get-Content -LiteralPath (Join-Path $RepositoryRoot "scripts\refresh-draftsharks-snapshot.py") -Raw
$snapshot = Get-Content -LiteralPath (Join-Path $RepositoryRoot "data\draftsharks-snapshots.json") -Raw | ConvertFrom-Json

foreach ($required in @(
  'id="draftsharks-source"',
  'id="draftsharks-local-refresh"',
  'id="draftsharks-source-updated"',
  'id="draftsharks-status"',
  'DraftSharks consensus ADP',
  'daily at 8:00 AM America/Los_Angeles'
)) {
  if (-not $index.Contains($required)) {
    throw "Missing DraftSharks UI control: $required"
  }
}
if ($index.Contains('id="draftsharks-refresh"') -or $index.Contains("Refresh DraftSharks ADP")) {
  throw "The dashboard still exposes a manual DraftSharks refresh control."
}

foreach ($required in @(
  'const draftSharksScoring = (scoring) => scoring === "halfPpr" ? "half-ppr" : "ppr";',
  'https://www.draftsharks.com/adp/${draftSharksScoring(state.scoring)}/consensus/${state.teams}',
  'fetch(`data/draftsharks-snapshots.json?cache=${Date.now()}`, { cache: "no-store" })',
  'DraftSharks snapshot metadata could not be loaded. The local Yahoo-primary board is unaffected',
  'const isValidatedSnapshot = (snapshot, state) =>',
  'Consensus ADP: ${market.consensusSource}',
  'Players absent from the snapshot use local AVG.',
  'Source timestamp unavailable in the validated public response.',
  'sourceUpdatedAt'
)) {
  if (-not $app.Contains($required)) {
    throw "Missing DraftSharks application behavior: $required"
  }
}

foreach ($required in @(
  "workflow_dispatch:",
  'cron: "0 15 * * *"',
  'cron: "0 16 * * *"',
  "draftsharks-schedule-guard.py",
  "for scoring in ppr half-ppr",
  "for teams in 10 12 14",
  "data/draftsharks-snapshots.json",
  "existing snapshot preserved",
  "git diff --quiet -- data/draftsharks-snapshots.json"
)) {
  if (-not $workflow.Contains($required)) {
    throw "Missing guarded workflow behavior: $required"
  }
}

foreach ($required in @(
  "len(records) < 20",
  "No snapshot or dashboard data was changed.",
  "The core Yahoo-primary ranking board was not modified.",
  "def parse_source_updated_at(document: str) -> str | None:",
  "sourceTimestampStatus",
  "return 1"
)) {
  if (-not $refreshScript.Contains($required)) {
    throw "Missing safe parser behavior: $required"
  }
}

if ($null -eq $snapshot.snapshots -or $snapshot.snapshots.Count -ne 0) {
  throw "Initial DraftSharks snapshot must be an empty, explicit metadata state."
}

$urls = @{}
foreach ($scoring in @{ ppr = "ppr"; halfPpr = "half-ppr" }.GetEnumerator()) {
  foreach ($teams in 10, 12, 14) {
    $url = "https://www.draftsharks.com/adp/$($scoring.Value)/consensus/$teams"
    if ($url -notmatch "^https://www\.draftsharks\.com/adp/(ppr|half-ppr)/consensus/(10|12|14)$") {
      throw "Invalid generated DraftSharks URL: $url"
    }
    $urls["$($scoring.Key)-$teams"] = $url
  }
}

Write-Output "DraftSharks refresh validation passed: 6 selected-source URLs, safe empty snapshot state, guarded workflow, and non-destructive parser checks."

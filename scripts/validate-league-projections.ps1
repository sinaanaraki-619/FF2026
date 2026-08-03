param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$projectionPath = Join-Path $RepositoryRoot "assets\projections.js"
$appPath = Join-Path $RepositoryRoot "assets\app.js"
$indexPath = Join-Path $RepositoryRoot "index.html"
$boardPath = Join-Path $RepositoryRoot "assets\data.js"
$projection = Get-Content -LiteralPath $projectionPath -Raw
$app = Get-Content -LiteralPath $appPath -Raw
$index = Get-Content -LiteralPath $indexPath -Raw
$board = Get-Content -LiteralPath $boardPath -Raw

function Assert-Equal {
  param([object]$Actual, [object]$Expected, [string]$Label)

  if ($Actual -is [double] -or $Expected -is [double]) {
    if ([math]::Abs([double]$Actual - [double]$Expected) -gt .0001) {
      throw "$Label expected $Expected but received $Actual."
    }
  } elseif ($Actual -ne $Expected) {
    throw "$Label expected $Expected but received $Actual."
  }
}

function Get-ProjectionScore {
  param([object]$Stats, [double]$ReceptionPoints)

  return $Stats.passYards / 25 + $Stats.passTouchdowns * 6 - $Stats.interceptions * 2 +
    $Stats.rushYards / 10 + $Stats.rushTouchdowns * 6 + $Stats.receptions * $ReceptionPoints +
    $Stats.receivingYards / 10 + $Stats.receivingTouchdowns * 6 - $Stats.fumbles * 2
}

foreach ($required in @(
  'assets/projections.js?v=20260803-league-model',
  'id="league-format"',
  'customHalfPpr',
  'customPpr',
  'id="league-model"'
)) {
  if (-not $index.Contains($required)) {
    throw "Missing league format UI wiring: $required"
  }
}
foreach ($required in @(
  'const projectedPoints = (player, state) =>',
  'const createScarcityModel = (players, state, market) =>',
  'const tierDropBeforeNextPick = (player, nextPick, market, scarcity) =>',
  'const rosterNeed = (player, roster) =>',
  'const scarcityAction = (player, pick, nextPick, market, scarcity, roster, marketAction) =>',
  'const leagueWideStarterCounts = Object.fromEntries(Object.entries(starterCounts).map(([position, count]) => [',
  'state.receptionPoints'
)) {
  if (-not $app.Contains($required)) {
    throw "Missing league game-theory behavior: $required"
  }
}

$records = @()
foreach ($match in [regex]::Matches($projection, '^\s*(\{.*\}),?\s*$', [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
  $records += $match.Groups[1].Value | ConvertFrom-Json
}
if ($records.Count -ne 19 -or -not $projection.Contains("sourceRecordCount: 108") -or -not $projection.Contains('sourcePositions: ["QB"]') -or -not $projection.Contains("matchedBoardRecordCount: 19")) {
  throw "Projection source coverage metadata does not match the supplied QB-only CSV."
}
if (@($records | Where-Object { $_.position -ne "QB" }).Count -ne 0) {
  throw "Projection asset fabricated a non-QB source position."
}

$allen = @($records | Where-Object { $_.id -eq "joshallen" })[0]
if ($null -eq $allen) {
  throw "Josh Allen projection did not join."
}
$halfScore = Get-ProjectionScore $allen .5
Assert-Equal $halfScore 416.588 "Josh Allen custom half-PPR score"
$synthetic = [pscustomobject]@{
  passYards = 0; passTouchdowns = 0; interceptions = 0; rushYards = 0; rushTouchdowns = 0
  receptions = 50; receivingYards = 0; receivingTouchdowns = 0; fumbles = 0
}
Assert-Equal ((Get-ProjectionScore $synthetic 1) - (Get-ProjectionScore $synthetic .5)) 25 "Full PPR reception adjustment"

$scoredQbs = @($records | ForEach-Object {
  [pscustomobject]@{ Id = $_.id; Points = Get-ProjectionScore $_ .5 }
} | Sort-Object Points -Descending)
if ($scoredQbs.Count -lt 13) {
  throw "Insufficient matched QB projection depth for QB13 replacement baseline."
}
$qb13 = $scoredQbs[12].Points
if ($halfScore -le $qb13) {
  throw "Josh Allen VORP is not positive against the dynamic QB13 baseline."
}
if ($projection -match '"id":"wandalerobinson"') {
  throw "Wan'Dale Robinson incorrectly received a projection from the QB-only CSV."
}

$playerPattern = '^\s*\["(?<id>[^"]+)","(?<name>[^"]+)","(?<position>[^"]+)",[^,]*,'
$rankPattern = '\["(?<id>[^"]+)",(?<rank>\d+),(?<tier>\d+)\]'
$players = @{}
foreach ($match in [regex]::Matches($board, $playerPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
  $players[$match.Groups["id"].Value] = [pscustomobject]@{
    Id = $match.Groups["id"].Value
    Position = $match.Groups["position"].Value
  }
}
$ranks = @{}
foreach ($match in [regex]::Matches($board, $rankPattern)) {
  $ranks[$match.Groups["id"].Value] = [int]$match.Groups["rank"].Value
}
$byPosition = @{}
foreach ($position in @("QB", "RB", "WR", "TE")) {
  $byPosition[$position] = @($players.Values | Where-Object { $_.Position -eq $position } | Sort-Object { $ranks[$_.Id] })
}
$core = @{ QB = 12; RB = 24; WR = 24; TE = 12 }
$flexPool = @(
  $byPosition.RB | Select-Object -Skip $core.RB
  $byPosition.WR | Select-Object -Skip $core.WR
  $byPosition.TE | Select-Object -Skip $core.TE
) | Sort-Object { $ranks[$_.Id] } | Select-Object -First 24
$flexTotal = @($flexPool).Count
Assert-Equal $flexTotal 24 "Two-flex league-wide allocation"

Write-Output "League projection validation passed: 19 matched QB records from the 108-row QB-only CSV; Josh Allen half-PPR 416.588; full PPR adds 0.5 per reception; dynamic QB13 VORP baseline and 24 two-flex allocations are valid; non-QB projections remain unavailable."

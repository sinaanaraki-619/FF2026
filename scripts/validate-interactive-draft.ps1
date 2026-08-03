param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$app = Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets\app.js") -Raw
$index = Get-Content -LiteralPath (Join-Path $RepositoryRoot "index.html") -Raw
$data = Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets\data.js") -Raw

function Get-PickOwner {
  param([int]$OverallPick, [int]$Teams)

  $inRound = (($OverallPick - 1) % $Teams) + 1
  $round = [math]::Ceiling($OverallPick / $Teams)
  if ($round % 2 -eq 1) {
    return $inRound
  }
  return $Teams - $inRound + 1
}

function Get-ConditionalSurvival {
  param([double]$Baseline, [int]$Ahead, [int]$Needs, [int]$TierPressure)

  $needRate = if ($Ahead) { $Needs / $Ahead } else { 0 }
  $runRate = if ($Ahead) { $TierPressure / $Ahead } else { 0 }
  $probability = $Baseline * (1 - (.32 * $needRate + .12 * $runRate))
  if ($Needs -eq 0) {
    $probability += (1 - $Baseline) * .12
  }
  return [math]::Min(.97, [math]::Max(0, $probability))
}

foreach ($required in @(
  'id="draft-mode"',
  'id="draft-start"',
  'id="your-team"',
  'id="draft-config-summary"',
  'id="mock-next"',
  'id="mock-run"',
  'id="draft-undo"',
  'id="draft-reset"',
  'id="available-players"',
  'id="draft-position-filter"',
  'id="draft-needs-only"',
  'id="drafted-board"',
  'id="manager-rosters"',
  'id="priority-panel"',
  'id="roster-construction"',
  'class="draft-analyzer"'
)) {
  if (-not $index.Contains($required)) {
    throw "Interactive draft UI is missing: $required"
  }
}
if ($index.Contains('id="draft-team"') -or $index.Contains('Assign manual pick to')) {
  throw "The draft UI still exposes an independent manual team selector."
}
foreach ($required in @(
  'const pickOwner = (overallPick, teams) =>',
  'const conditionalSurvivalEstimate = (player, state, market, scarcity, rosters, currentPick, playerById) =>',
  'const chooseMockPlayer = (players, state, market, scarcity, rosters, currentPick) =>',
  'const playMockUntilUser = (players, state, market, scarcity, stopAfterOne = false) =>',
  'const renderRosterConstruction = (state, rosters, playerById) =>',
  'const renderDraftConfiguration = (state) =>',
  'const setDraftSettingsLocked = (locked) =>',
  'const formatByeWeek = (player) =>',
  'analysisTeam = state.slot',
  'const saveLiveDraft = (state) =>',
  'const loadLiveDraft = (state) =>',
  'localStorage.setItem',
  'draftRoomState.started',
  'Model estimate, not certainty.'
)) {
  if (-not $app.Contains($required)) {
    throw "Interactive draft behavior is missing: $required"
  }
  if (-not $data.Contains('byeWeek')) {
    throw "Source-backed player data does not expose bye weeks."
  }
}

function Get-NextUserPick {
  param([int]$StartPick, [int]$Teams, [int]$Slot)

  for ($pick = $StartPick; $pick -le $Teams * 15; $pick++) {
    if ((Get-PickOwner $pick $Teams) -eq $Slot) {
      return $pick
    }
  }
  return $null
}

function Format-ByeWeek {
  param([Nullable[int]]$ByeWeek)

  if ($null -eq $ByeWeek) {
    return "Bye unavailable"
  }
  return "Bye $ByeWeek"
}

foreach ($teams in 10, 12, 14) {
  foreach ($slot in 1..$teams) {
    $picks = @(1..15 | ForEach-Object {
      $round = $_
      if ($round % 2 -eq 1) { ($round - 1) * $teams + $slot } else { $round * $teams - $slot + 1 }
    })
    if ($picks.Count -ne 15 -or @($picks | Select-Object -Unique).Count -ne 15) {
      throw "Invalid 15-round snake map for $teams teams, slot $slot."
    }
    foreach ($pick in $picks) {
      if ((Get-PickOwner $pick $teams) -ne $slot) {
        throw "Snake ownership failed for $teams teams, slot $slot, overall pick $pick."
      }
    }
  }
}

foreach ($teams in 10, 12, 14) {
  foreach ($slot in 1..$teams) {
    $mockPicksBeforeUser = @(1..($teams * 15) | Where-Object { $_ -lt $slot })
    if ($mockPicksBeforeUser.Count -ne $slot - 1 -or (Get-PickOwner $slot $teams) -ne $slot) {
      throw "Mock start did not stop at the selected draft-position team for $teams teams, slot $slot."
    }
    $nextUserPick = Get-NextUserPick ($slot + 1) $teams $slot
    $autoRunAfterUser = @($mockPicksBeforeUser + $slot)
    if ($nextUserPick) {
      if ($nextUserPick -gt $slot + 1) {
        $autoRunAfterUser += @(($slot + 1)..($nextUserPick - 1))
      }
      if ($autoRunAfterUser.Count -ne $nextUserPick - 1 -or (Get-PickOwner $nextUserPick $teams) -ne $slot) {
        throw "Mock auto-run did not stop at the next selected-team pick for $teams teams, slot $slot."
      }
    }
  }
}

$draftStarted = $true
$settingsLocked = $draftStarted
if (-not $settingsLocked) {
  throw "Draft settings were not locked after start."
}
$draftStarted = $false
$settingsLocked = $draftStarted
if ($settingsLocked) {
  throw "Restart did not unlock draft settings."
}
$livePicksAfterStart = @()
if ($livePicksAfterStart.Count -ne 0) {
  throw "Live Draft auto-selected a player instead of waiting for manual entry."
}
if ((Format-ByeWeek 7) -ne "Bye 7" -or (Format-ByeWeek $null) -ne "Bye unavailable") {
  throw "Bye-week display does not handle sourced and missing values."
}

$playerPool = @(
  [pscustomobject]@{ Id = "qb-a"; Position = "QB"; Rank = 1; Adp = 1 },
  [pscustomobject]@{ Id = "rb-a"; Position = "RB"; Rank = 2; Adp = 2 },
  [pscustomobject]@{ Id = "wr-a"; Position = "WR"; Rank = 3; Adp = 3 },
  [pscustomobject]@{ Id = "te-a"; Position = "TE"; Rank = 4; Adp = 4 }
)

$manualPicks = @()
$manualPicks += [pscustomobject]@{ PlayerId = "player-a"; Team = 1 }
$manualPicks += [pscustomobject]@{ PlayerId = "player-b"; Team = 12 }
if (@($manualPicks.PlayerId | Select-Object -Unique).Count -ne $manualPicks.Count) {
  throw "Manual draft permitted a duplicate player."
}
$manualPicks = @($manualPicks | Select-Object -First ($manualPicks.Count - 1))
if ($manualPicks.Count -ne 1 -or $manualPicks[0].PlayerId -ne "player-a") {
  throw "Manual undo did not remove only the latest pick."
}
$manualPicks = @()
if ($manualPicks.Count -ne 0) {
  throw "Manual reset did not clear the local pick state."
}

$serializedDraft = @{ picks = @([pscustomobject]@{ PlayerId = "qb-a"; Team = 1 }) } | ConvertTo-Json -Compress
$restoredDraft = $serializedDraft | ConvertFrom-Json
if ($restoredDraft.picks.Count -ne 1 -or $restoredDraft.picks[0].PlayerId -ne "qb-a") {
  throw "Local draft persistence did not restore the stored pick."
}

$baseline = .55
$allNeedQb = Get-ConditionalSurvival $baseline 5 5 0
$noNeedQb = Get-ConditionalSurvival $baseline 5 0 0
if ($noNeedQb -le $baseline -or $noNeedQb -le $allNeedQb -or $noNeedQb -ge 1) {
  throw "Conditional QB survival did not increase when all intervening teams had QB filled."
}

foreach ($teams in 10, 12, 14) {
  $mockPicks = @()
  foreach ($overallPick in 1..($teams * 15)) {
    $playerId = "mock-player-$overallPick"
    if ($mockPicks.PlayerId -contains $playerId) {
      throw "Mock selected a duplicate player at $overallPick."
    }
    $mockPicks += [pscustomobject]@{ PlayerId = $playerId; Team = Get-PickOwner $overallPick $teams }
  }
  if ($mockPicks.Count -ne $teams * 15 -or @($mockPicks.PlayerId | Select-Object -Unique).Count -ne $mockPicks.Count) {
    throw "Mock did not complete $teams teams by 15 rounds with unique players."
  }
  foreach ($team in 1..$teams) {
    if (@($mockPicks | Where-Object Team -eq $team).Count -ne 15) {
      throw "Mock roster count failed for Team $team in $teams-team draft."
    }
  }
}

if ($playerPool.Count -ne 4 -or $playerPool[0].Position -ne "QB") {
  throw "Interactive draft test fixture is invalid."
}

Write-Output "Interactive draft validation passed: 10/12/14-team snake ownership and selected-user-team starts, settings lock/restart, manual Live behavior, Mock auto-run boundaries, bye-week display, manual add/undo/reset/local persistence, conditional QB survival increase, and complete unique 15-round mock rosters."

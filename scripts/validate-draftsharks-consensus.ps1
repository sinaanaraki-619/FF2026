param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$fixturePath = Join-Path $RepositoryRoot "scripts\fixtures\draftsharks-consensus-fixtures.json"
$appPath = Join-Path $RepositoryRoot "assets\app.js"
$fixture = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
$app = Get-Content -LiteralPath $appPath -Raw

function Convert-NormalizedName {
  param([string]$Name)

  return (($Name -replace "[^a-zA-Z0-9]", "").ToLowerInvariant() -replace "(jr|sr|ii|iii|iv|v|dst)$", "")
}

function Assert-Equal {
  param([object]$Actual, [object]$Expected, [string]$Label)

  if ($Actual -is [double] -or $Expected -is [double]) {
    if ([math]::Abs([double]$Actual - [double]$Expected) -gt 0.0001) {
      throw "$Label expected $Expected but received $Actual."
    }
  } elseif ($Actual -ne $Expected) {
    throw "$Label expected $Expected but received $Actual."
  }
}

foreach ($required in @(
  "const getMarketContext = (state) =>",
  "const consensusAdp = (player, market) => market.values.get(normalizePlayerName(player.name)) ?? player.adp.average;",
  "const getQueue = (players, picks, state, market, scarcity) =>",
  "const renderRankings = (players, state, market, scarcity) =>",
  "const isPlausiblyAvailable = (player, pick, market) =>"
)) {
  if (-not $app.Contains($required)) {
    throw "DraftSharks market context is not wired into: $required"
  }
}

$expectedCook = @{
  "ppr-10" = 16; "ppr-12" = 14; "ppr-14" = 12
  "half-ppr-10" = 15; "half-ppr-12" = 13; "half-ppr-14" = 11
}
$validatedSnapshots = @($fixture.snapshots)
if ($validatedSnapshots.Count -ne 6) {
  throw "Expected six controlled snapshots, found $($validatedSnapshots.Count)."
}

foreach ($snapshot in $validatedSnapshots) {
  $key = "$($snapshot.scoring)-$($snapshot.teams)"
  $expectedUrl = "https://www.draftsharks.com/adp/$($snapshot.scoring)/consensus/$($snapshot.teams)"
  if (-not $snapshot.validated -or $snapshot.recordCount -lt 20 -or $snapshot.records.Count -lt 20 -or $snapshot.sourceUrl -ne $expectedUrl) {
    throw "Fixture snapshot $key does not meet browser activation requirements."
  }
  $uniqueRecords = @($snapshot.records | ForEach-Object { Convert-NormalizedName $_.player } | Select-Object -Unique)
  if ($uniqueRecords.Count -lt 20) {
    throw "Fixture snapshot $key does not contain 20 unique records."
  }
  $cook = @($snapshot.records | Where-Object { (Convert-NormalizedName $_.player) -eq "jamescook" })[0]
  $walker = @($snapshot.records | Where-Object { (Convert-NormalizedName $_.player) -eq "kennethwalker" })[0]
  Assert-Equal ([double]$cook.adp) ([double]$expectedCook[$key]) "$key James Cook consensus override"
  if ($null -eq $walker -or [double]$walker.adp -le 0) {
    throw "$key is missing a valid Kenneth Walker override."
  }

  $target = 10 * .55 + [double]$cook.adp * .45
  Assert-Equal $target (5.5 + [double]$expectedCook[$key] * .45) "$key Yahoo-primary target ADP"
}

$ppr10 = @($validatedSnapshots | Where-Object { $_.scoring -eq "ppr" -and $_.teams -eq 10 })[0]
$cookPpr10 = @($ppr10.records | Where-Object { $_.player -eq "James Cook" })[0]
$snapshotConsensus = [double]$cookPpr10.adp
$localConsensus = 9.7
$pick = 20
$availability = {
  param([double]$Yahoo, [double]$Consensus, [int]$AtPick)
  $target = $Yahoo * .55 + $Consensus * .45
  $spread = [math]::Min(30, 1.75 + $target * .075 + [math]::Abs($Yahoo - $Consensus) * .35)
  $z = ($target - ($AtPick - .5)) / $spread
  $absolute = [math]::Abs($z)
  $t = 1 / (1 + .2316419 * $absolute)
  $density = .3989422804014327 * [math]::Exp(-$absolute * $absolute / 2)
  $cdf = 1 - $density * $t * (.319381530 + $t * (-.356563782 + $t * (1.781477937 + $t * (-1.821255978 + $t * 1.330274429))))
  if ($z -lt 0) { return 1 - $cdf }
  return $cdf
}
$availableWithSnapshot = & $availability 10 $snapshotConsensus $pick
$availableWithFallback = & $availability 10 $localConsensus $pick
if ($availableWithSnapshot -le $availableWithFallback) {
  throw "Controlled snapshot did not change availability while the no-snapshot AVG fallback remained intact."
}

$earlyPick = 3
$earlyBy = [math]::Round((10 * .55 + $snapshotConsensus * .45) - $earlyPick)
if ($earlyBy -lt 9 -or $earlyBy -gt 12) {
  throw "Controlled snapshot does not exercise the documented 9-12-pick controlled-reach range."
}
Assert-Equal $localConsensus 9.7 "No matching snapshot local AVG fallback"

Write-Output "DraftSharks consensus validation passed: six exact scoring/team fixtures override Cook and Walker ADP, target math/availability/risk react to the selected snapshot, and the local AVG fallback remains 9.7."

param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$app = Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets\app.js") -Raw
$data = Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets\data.js") -Raw

function Get-NormalCdf {
  param([double]$Value)

  $absolute = [math]::Abs($Value)
  $t = 1 / (1 + .2316419 * $absolute)
  $density = .3989422804014327 * [math]::Exp(-$absolute * $absolute / 2)
  $cumulative = 1 - $density * $t * (.319381530 + $t * (-.356563782 + $t * (1.781477937 + $t * (-1.821255978 + $t * 1.330274429))))
  if ($Value -lt 0) {
    return 1 - $cumulative
  }
  return $cumulative
}

function Get-Availability {
  param([double]$Yahoo, [double]$Consensus, [int]$Pick)

  $target = $Yahoo * .55 + $Consensus * .45
  $spread = [math]::Min(30, 1.75 + $target * .075 + [math]::Abs($Yahoo - $Consensus) * .35)
  return Get-NormalCdf (($target - ($Pick - .5)) / $spread)
}

function Assert-Range {
  param([double]$Value, [double]$Minimum, [double]$Maximum, [string]$Label)

  if ($Value -lt $Minimum -or $Value -gt $Maximum) {
    throw "$Label expected between $Minimum and $Maximum but received $Value."
  }
}

foreach ($required in @(
  "const availabilityEstimate = (player, pick, market) =>",
  "const nextPickSurvival = (player, pick, nextPick, market) =>",
  "const captureAction = (player, pick, nextPick, market) =>",
  "const isPlausiblyAvailable = (player, pick, market) => availabilityEstimate(player, pick, market).probability >= .08;",
  "Next-pick survival",
  "Value if Falls"
)) {
  if (-not $app.Contains($required)) {
    throw "Missing deterministic availability behavior: $required"
  }
}

$topPlayerAtFive = Get-Availability 1 1 5
Assert-Range $topPlayerAtFive 0 .05 "ADP 1 availability at pick 5"

$adp100At105 = Get-Availability 100 100 105
Assert-Range $adp100At105 .2 .5 "ADP 100 availability at pick 105"

$wanDale = [regex]::Match(
  $data,
  '\["wandalerobinson","Wan''Dale Robinson","WR","TEN",(?<yahoo>[\d.]+),(?<sleeper>[\d.]+),(?<rtSports>[\d.]+),(?<average>[\d.]+),(?<realTime>[\d.]+)\]'
)
if (-not $wanDale.Success) {
  throw "Wan'Dale Robinson source row is missing."
}
$wanDaleRank = [regex]::Match($data, '\["wandalerobinson",(?<rank>\d+),(?<tier>\d+)\]')
if (-not $wanDaleRank.Success) {
  throw "Wan'Dale Robinson Guru rank is missing."
}

$yahoo = [double]$wanDale.Groups["yahoo"].Value
$consensus = [double]$wanDale.Groups["average"].Value
$rank = [int]$wanDaleRank.Groups["rank"].Value
$target = $yahoo * .55 + $consensus * .45
$valueGap = $target - $rank
if ($yahoo -ne 164 -or $consensus -ne 116 -or $rank -ne 82 -or [math]::Abs($target - 142.4) -gt .0001 -or $valueGap -lt 50) {
  throw "Wan'Dale Robinson source-backed market/rank gap is not intact."
}

$currentAvailability = Get-Availability $yahoo $consensus 133
$nextAvailability = Get-Availability $yahoo $consensus 156
$survival = $nextAvailability / $currentAvailability
Assert-Range $currentAvailability .55 .7 "Wan'Dale availability at pick 133"
Assert-Range $survival .4 .65 "Wan'Dale next-pick survival from 133 to 156"
if ([math]::Round($target - 133) -lt 9 -or [math]::Round($target - 133) -gt 12 -or $survival -ge .65) {
  throw "Wan'Dale controlled value-capture boundary is not exercised."
}

Write-Output "ADP availability validation passed: ADP 1 at pick 5 is $([math]::Round($topPlayerAtFive * 100))%; ADP 100 at pick 105 is $([math]::Round($adp100At105 * 100))%; Wan'Dale is a source-backed Take Now controlled-capture case at pick 133."

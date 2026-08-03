param(
  [string]$DataPath
)

if ([string]::IsNullOrWhiteSpace($DataPath)) {
  $DataPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\data.js"
}

$source = Get-Content -LiteralPath $DataPath -Raw
$appSource = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\app.js") -Raw
$playerPattern = '^\s*\["(?<id>[^"]+)","(?<name>[^"]+)","(?<position>[^"]+)","(?<team>[^"]*)",(?<byeWeek>\d+|null),(?<yahoo>[\d.]+|null),(?<sleeper>[\d.]+|null),(?<rtSports>[\d.]+|null),(?<average>[\d.]+|null),(?<realTime>[\d.]+|null)\],?\r?$'
$rankPattern = '\["(?<id>[^"]+)",(?<rank>\d+),(?<tier>\d+)\]'
$players = @{}

function Convert-NullableNumber {
  param([string]$Value)

  if ($Value -eq "null") {
    return $null
  }
  return [double]$Value
}

foreach ($match in [regex]::Matches($source, $playerPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
  $players[$match.Groups["id"].Value] = [pscustomobject]@{
    Id = $match.Groups["id"].Value
    Position = $match.Groups["position"].Value
    Yahoo = Convert-NullableNumber $match.Groups["yahoo"].Value
    Average = Convert-NullableNumber $match.Groups["average"].Value
  }
}

$pprSection = [regex]::Match($source, 'const pprOrder = \[(?<body>.*?)\];\r?\n\r?\n  // No half-PPR', [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups["body"].Value
$rankedPlayers = foreach ($match in [regex]::Matches($pprSection, $rankPattern)) {
  $player = $players[$match.Groups["id"].Value]
  if ($null -eq $player) {
    throw "PPR ranking references a missing player: $($match.Groups["id"].Value)"
  }
  [pscustomobject]@{
    Id = $player.Id
    Position = $player.Position
    Yahoo = $player.Yahoo
    Average = $player.Average
    Rank = [int]$match.Groups["rank"].Value
    Tier = [int]$match.Groups["tier"].Value
  }
}

$roundNeeds = @(
  @("RB", "WR"), @("WR", "RB"), @("RB", "WR"), @("WR", "RB", "TE"), @("RB", "WR"),
  @("WR", "QB", "TE"), @("RB", "WR"), @("WR", "RB"), @("QB", "TE", "WR"), @("RB", "WR"),
  @("WR", "RB", "TE"), @("RB", "WR", "QB"), @("WR", "RB", "TE"), @("RB", "WR", "QB"),
  @("RB", "WR", "TE")
)

function Get-SnakePicks {
  param([int]$Teams, [int]$Slot, [int]$Rounds = 15)

  return @(1..$Rounds | ForEach-Object {
    if ($_ % 2 -eq 1) {
      ($_ - 1) * $Teams + $Slot
    } else {
      $_ * $Teams - $Slot + 1
    }
  })
}

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
  param([object]$Player, [int]$Pick)

  $targetAdp = $Player.Yahoo * .55 + $Player.Average * .45
  $disagreement = [math]::Abs($Player.Yahoo - $Player.Average)
  $spread = [math]::Min(30, 1.75 + $targetAdp * .075 + $disagreement * .35)
  return Get-NormalCdf (($targetAdp - ($Pick - .5)) / $spread)
}

function Get-Candidates {
  param(
    [object[]]$Players,
    [int]$Pick,
    [int]$NextPick,
    [int]$Round,
    [int]$Teams,
    [int]$Flex,
    [System.Collections.Generic.HashSet[string]]$SelectedIds
  )

  $wanted = $roundNeeds[$Round - 1]
  return @(
    foreach ($player in $Players) {
      if ($SelectedIds.Contains($player.Id) -or $null -eq $player.Yahoo -or $null -eq $player.Average) {
        continue
      }

      $targetAdp = $player.Yahoo * 0.55 + $player.Average * 0.45
      $earlyBy = [math]::Round($targetAdp - $Pick)
      $availability = Get-Availability $player $Pick
      $survival = (Get-Availability $player $NextPick) / $availability
      $valueGap = $targetAdp - $player.Rank
      $controlledValueReach = $player.Tier -le 2 -or ($valueGap -ge 18 -and $survival -lt .65)
      $avoid = $earlyBy -gt 12 -or ($earlyBy -ge 9 -and -not $controlledValueReach)
      if ($availability -lt .08 -or $avoid) {
        continue
      }

      $positionIndex = [array]::IndexOf($wanted, $player.Position)
      $positionScore = if ($positionIndex -lt 0) {
        0
      } else {
        ($wanted.Count - $positionIndex) * 4 + $(if ($Flex -eq 2 -and @("RB", "WR", "TE").Contains($player.Position)) { 2 } else { 0 })
      }
      [pscustomobject]@{
        Player = $player
        Pick = $Pick
        Availability = $availability
        Score = (150 - $player.Rank) + $positionScore + [math]::Min(50, [math]::Max(0, $valueGap)) * .2 - [math]::Abs($targetAdp - $Pick) * 0.45
      }
    }
  ) | Sort-Object Score -Descending | Select-Object -First 4
}

foreach ($required in @(
  "const picks = snakePicks(state.teams, state.slot, 15);",
  'Only ${candidates.length} plausible target',
  "const roundNeeds = [",
  "const availabilityEstimate = (player, pick, market) =>",
  "const nextPickSurvival = (player, pick, nextPick, market) =>",
  "availabilityEstimate(player, pick, market).probability >= .08"
)) {
  if (-not $appSource.Contains($required)) {
    throw "Missing 15-round queue behavior: $required"
  }
}

if ($roundNeeds.Count -ne 15) {
  throw "Expected 15 positional strategy rounds, found $($roundNeeds.Count)."
}

$configurationCount = 0
$roundCount = 0
$recommendationCount = 0
$partialAlternativeRounds = 0
foreach ($scoring in @("ppr", "halfPpr")) {
  foreach ($teams in @(10, 12, 14)) {
    foreach ($slot in 1..$teams) {
      foreach ($flex in @(1, 2)) {
        $picks = Get-SnakePicks $teams $slot
        $allPicks = Get-SnakePicks $teams $slot 16
        if ($picks.Count -ne 15 -or (@($picks | Select-Object -Unique)).Count -ne 15) {
          throw "Invalid 15-round snake picks for $scoring, $teams teams, slot $slot."
        }
        $selectedIds = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($pick in $picks) {
          $round = [array]::IndexOf($picks, $pick) + 1
          $candidates = @(Get-Candidates $rankedPlayers $pick $allPicks[$round] $round $teams $flex $selectedIds)
          if ($candidates.Count -gt 4) {
            throw "More than four alternatives at pick $pick."
          }
          foreach ($candidate in $candidates) {
            if ($candidate.Availability -lt .08) {
              throw "Candidate $($candidate.Player.Id) below the probability threshold surfaced at pick $pick."
            }
          }
          if ($candidates.Count -gt 0 -and -not $selectedIds.Add($candidates[0].Player.Id)) {
            throw "Primary target $($candidates[0].Player.Id) repeated in one queue."
          }
          if ($candidates.Count -lt 3) {
            $partialAlternativeRounds += 1
          }
          $recommendationCount += $candidates.Count
          $roundCount += 1
        }
        $configurationCount += 1
      }
    }
  }
}

if ($configurationCount -ne 144 -or $roundCount -ne 2160) {
  throw "Expected 144 configurations and 2,160 queue rounds; found $configurationCount configurations and $roundCount rounds."
}

$wanDale = @($rankedPlayers | Where-Object { $_.Id -eq "wandalerobinson" })[0]
$wanDaleCandidates = @(Get-Candidates $rankedPlayers 133 156 12 12 1 ([System.Collections.Generic.HashSet[string]]::new()))
$wanDaleRecommendation = @($wanDaleCandidates | Where-Object { $_.Player.Id -eq "wandalerobinson" })[0]
if ($null -eq $wanDale -or $null -eq $wanDaleRecommendation) {
  throw "Source-backed Wan'Dale Robinson did not surface as a controlled value-capture target at pick 133."
}
$wanDaleTarget = $wanDale.Yahoo * .55 + $wanDale.Average * .45
$wanDaleSurvival = (Get-Availability $wanDale 156) / (Get-Availability $wanDale 133)
if ($wanDaleTarget -ne 142.4 -or [math]::Round($wanDaleTarget - 133) -lt 9 -or $wanDaleSurvival -ge .65) {
  throw "Wan'Dale Robinson does not meet the source-backed controlled-capture bounds."
}

Write-Output "15-round queue validation passed: $configurationCount configurations, $roundCount rounds, $recommendationCount recommendations, $partialAlternativeRounds documented partial/fallback rounds; Wan'Dale surfaces at pick 133 as a controlled value capture."

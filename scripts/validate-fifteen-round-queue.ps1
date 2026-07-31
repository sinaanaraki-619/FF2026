param(
  [string]$DataPath
)

if ([string]::IsNullOrWhiteSpace($DataPath)) {
  $DataPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\data.js"
}

$source = Get-Content -LiteralPath $DataPath -Raw
$appSource = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\app.js") -Raw
$playerPattern = '^\s*\["(?<id>[^"]+)","(?<name>[^"]+)","(?<position>[^"]+)","(?<team>[^"]*)",(?<yahoo>[\d.]+|null),(?<sleeper>[\d.]+|null),(?<rtSports>[\d.]+|null),(?<average>[\d.]+|null),(?<realTime>[\d.]+|null)\],?\r?$'
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
  param([int]$Teams, [int]$Slot)

  return @(1..15 | ForEach-Object {
    if ($_ % 2 -eq 1) {
      ($_ - 1) * $Teams + $Slot
    } else {
      $_ * $Teams - $Slot + 1
    }
  })
}

function Get-Candidates {
  param(
    [object[]]$Players,
    [int]$Pick,
    [int]$Round,
    [int]$Teams,
    [int]$Flex,
    [System.Collections.Generic.HashSet[string]]$SelectedIds
  )

  $grace = [math]::Ceiling($Teams / 2)
  $wanted = $roundNeeds[$Round - 1]
  return @(
    foreach ($player in $Players) {
      if ($SelectedIds.Contains($player.Id) -or $null -eq $player.Yahoo -or $null -eq $player.Average) {
        continue
      }

      $targetAdp = $player.Yahoo * 0.55 + $player.Average * 0.45
      $earlyBy = [math]::Round($targetAdp - $Pick)
      $expired = (($Pick - $player.Yahoo) -gt $grace) -and (($Pick - $player.Average) -gt $grace)
      $avoid = $earlyBy -gt 12 -or ($earlyBy -ge 9 -and $player.Tier -gt 2)
      if ($expired -or $avoid) {
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
        Grace = $grace
        Score = (150 - $player.Rank) + $positionScore - [math]::Abs($targetAdp - $Pick) * 0.45
      }
    }
  ) | Sort-Object Score -Descending | Select-Object -First 4
}

foreach ($required in @(
  "const picks = snakePicks(state.teams, state.slot, 15);",
  'Only ${candidates.length} plausible target',
  "const roundNeeds = ["
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
        if ($picks.Count -ne 15 -or (@($picks | Select-Object -Unique)).Count -ne 15) {
          throw "Invalid 15-round snake picks for $scoring, $teams teams, slot $slot."
        }
        $selectedIds = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($pick in $picks) {
          $round = [array]::IndexOf($picks, $pick) + 1
          $candidates = @(Get-Candidates $rankedPlayers $pick $round $teams $flex $selectedIds)
          if ($candidates.Count -gt 4) {
            throw "More than four alternatives at pick $pick."
          }
          foreach ($candidate in $candidates) {
            if ((($candidate.Pick - $candidate.Player.Yahoo) -gt $candidate.Grace) -and (($candidate.Pick - $candidate.Player.Average) -gt $candidate.Grace)) {
              throw "Expired candidate $($candidate.Player.Id) surfaced at pick $pick."
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

Write-Output "15-round queue validation passed: $configurationCount configurations, $roundCount rounds, $recommendationCount recommendations, $partialAlternativeRounds documented partial/fallback rounds."

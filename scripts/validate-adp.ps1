param(
  [string]$DataPath
)

if ([string]::IsNullOrWhiteSpace($DataPath)) {
  $DataPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\data.js"
}

$source = Get-Content -LiteralPath $DataPath -Raw
$appSource = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\app.js") -Raw
$playerPattern = '^\s*\["(?<id>[^"]+)","(?<name>[^"]+)","(?<position>[^"]+)","(?<team>[^"]*)",(?<byeWeek>\d+|null),(?<yahoo>[\d.]+|null),(?<sleeper>[\d.]+|null),(?<rtSports>[\d.]+|null),(?<average>[\d.]+|null),(?<realTime>[\d.]+|null)\],?\r?$'
$rankPattern = '^\s*\["(?<id>[^"]+)",(?<rank>\d+),(?<tier>\d+)\],?\r?$'
$players = @{}
$playerNames = [System.Collections.Generic.HashSet[string]]::new()

function Convert-NullableNumber {
  param([string]$Value)

  if ($Value -eq "null") {
    return $null
  }
  return [double]$Value
}

foreach ($match in [regex]::Matches($source, $playerPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
  $id = $match.Groups["id"].Value
  if ($players.ContainsKey($id) -or -not $playerNames.Add($match.Groups["name"].Value)) {
    throw "Duplicate generated player identity: $id"
  }
  $players[$id] = [pscustomobject]@{
    Name = $match.Groups["name"].Value
    Position = $match.Groups["position"].Value
    Team = $match.Groups["team"].Value
    ByeWeek = Convert-NullableNumber $match.Groups["byeWeek"].Value
    Yahoo = Convert-NullableNumber $match.Groups["yahoo"].Value
    Sleeper = Convert-NullableNumber $match.Groups["sleeper"].Value
    RtSports = Convert-NullableNumber $match.Groups["rtSports"].Value
    Average = Convert-NullableNumber $match.Groups["average"].Value
    RealTime = Convert-NullableNumber $match.Groups["realTime"].Value
  }
}

$pprSection = [regex]::Match($source, 'const pprOrder = \[(?<body>.*?)\];\r?\n\r?\n  // No half-PPR', [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups["body"].Value
$ranks = @{}
foreach ($match in [regex]::Matches($pprSection, $rankPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
  $id = $match.Groups["id"].Value
  if ($ranks.ContainsKey($id)) {
    throw "Duplicate PPR rank entry: $id"
  }
  $ranks[$id] = [int]$match.Groups["rank"].Value
}

function Assert-Value {
  param(
    [object]$Actual,
    [object]$Expected,
    [string]$Label
  )

  if ($null -eq $Expected -and $null -eq $Actual) {
    return
  }
  if ($Actual -is [double] -or $Expected -is [double]) {
    if ([math]::Abs([double]$Actual - [double]$Expected) -gt 0.0001) {
      throw "$Label expected $Expected but received $Actual."
    }
    return
  }
  if ($Actual -ne $Expected) {
    throw "$Label expected $Expected but received $Actual."
  }
}

function Assert-Player {
  param(
    [string]$Id,
    [string]$Name,
    [string]$Position,
    [string]$Team,
    [object]$ByeWeek,
    [int]$Rank,
    [object]$Yahoo,
    [object]$Sleeper,
    [object]$RtSports,
    [object]$Average,
    [object]$RealTime
  )

  if (-not $players.ContainsKey($Id) -or -not $ranks.ContainsKey($Id)) {
    throw "Missing representative source player: $Id"
  }
  $player = $players[$Id]
  Assert-Value $player.Name $Name "$Name name"
  Assert-Value $player.Position $Position "$Name position"
  Assert-Value $player.Team $Team "$Name team"
  Assert-Value $player.ByeWeek $ByeWeek "$Name bye week"
  Assert-Value $ranks[$Id] $Rank "$Name Guru rank"
  Assert-Value $player.Yahoo $Yahoo "$Name Yahoo ADP"
  Assert-Value $player.Sleeper $Sleeper "$Name Sleeper ADP"
  Assert-Value $player.RtSports $RtSports "$Name RTSports ADP"
  Assert-Value $player.Average $Average "$Name source AVG"
  Assert-Value $player.RealTime $RealTime "$Name Real-Time ADP"
}

if ($players.Count -ne 198 -or $ranks.Count -ne 198 -or $players.Count -ne $ranks.Count) {
  throw "Expected 198 unique source-backed records and ranks; found $($players.Count) players and $($ranks.Count) ranks."
}
if (($players.Keys | Where-Object { -not $ranks.ContainsKey($_) }).Count -ne 0) {
  throw "Player and PPR rank identities differ."
}
if (-not $source.Contains("sourceRecordCount: 198") -or -not $source.Contains("excludedGuruRecords: [`"Bryce Lance`",`"Carolina Panthers`"]")) {
  throw "Source record-count or documented exclusions are missing."
}
if (-not $source.Contains("const halfPprOrder = pprOrder.map((entry) => [...entry]);")) {
  throw "The provisional half-PPR board is not a distinct PPR-derived structure."
}
if (-not $appSource.Contains("const consensusAdp = (player, market) => market.values.get(normalizePlayerName(player.name)) ?? player.adp.average;")) {
  throw "The dashboard no longer retains supplied AVG as the safe per-player consensus fallback."
}
if (-not $appSource.Contains('const formatByeWeek = (player) => Number.isInteger(player.byeWeek) ? `Bye ${player.byeWeek}` : "Bye unavailable";')) {
  throw "The dashboard does not represent unavailable bye weeks explicitly."
}
if (($players.Values | Where-Object { $null -ne $_.ByeWeek -and ($_.ByeWeek -lt 1 -or $_.ByeWeek -gt 18) }).Count -ne 0) {
  throw "A generated player has an invalid bye week."
}

Assert-Player "jamarrchase" "Ja'Marr Chase" "WR" "CIN" 6 1 3 3 3 3 3
Assert-Player "jamescook" "James Cook III" "RB" "BUF" 7 12 10 9 10 9.7 9
Assert-Player "tylerwarren" "Tyler Warren" "TE" "IND" 13 52 49 51 57 52.3 48
$eddyName = "Eddy Pi" + [char]0x00F1 + "eiro"
Assert-Player "eddypineiro" $eddyName "K" "SF" 8 189 219 $null 237 228 170
Assert-Player "kennethwalker" "Kenneth Walker III" "RB" "KC" 5 15 21 22 18 20.3 17

$cook = $players["jamescook"]
$walker = $players["kennethwalker"]
Assert-Value ($cook.Yahoo * 0.55 + $cook.Average * 0.45) 9.865 "James Cook target ADP"
Assert-Value ($walker.Yahoo * 0.55 + $walker.Average * 0.45) 20.685 "Kenneth Walker target ADP"

Write-Output "Source integrity validation passed: 198 unique records/ranks with valid source bye weeks; early, mid, and late source rows match; Cook AVG 9.7 and Walker AVG 20.3."

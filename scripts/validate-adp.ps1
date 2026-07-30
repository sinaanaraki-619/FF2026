param(
  [string]$DataPath = (Join-Path $PSScriptRoot "..\assets\data.js")
)

$source = Get-Content -LiteralPath $DataPath -Raw
$appSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot "..\assets\app.js") -Raw
$playerPattern = '^\s*\["(?<id>[^"]+)", "(?<name>[^"]+)", "(?<position>[^"]+)", "(?<team>[^"]+)", (?<yahoo>[\d.]+), (?<sleeper>[\d.]+), (?<rtSports>[\d.]+), (?<realTime>[\d.]+)\],?\r?$'
$players = @{}

foreach ($match in [regex]::Matches($source, $playerPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
  $players[$match.Groups["id"].Value] = [pscustomobject]@{
    Yahoo = [double]$match.Groups["yahoo"].Value
    Sleeper = [double]$match.Groups["sleeper"].Value
    RtSports = [double]$match.Groups["rtSports"].Value
    RealTime = [double]$match.Groups["realTime"].Value
  }
}

function Get-ConsensusAdp {
  param([object]$Player)

  return ($Player.Sleeper * 0.2 + $Player.RtSports * 0.15 + $Player.RealTime * 0.1) / 0.45
}

function Get-TargetAdp {
  param([object]$Player)

  return $Player.Yahoo * 0.55 + (Get-ConsensusAdp $Player) * 0.45
}

function Assert-Close {
  param(
    [double]$Actual,
    [double]$Expected,
    [string]$Label
  )

  if ([math]::Abs($Actual - $Expected) -gt 0.0001) {
    throw "$Label expected $Expected but received $Actual."
  }
}

foreach ($requiredPlayer in @("kenneth-walker", "ja-marr-chase")) {
  if (-not $players.ContainsKey($requiredPlayer)) {
    throw "Missing $requiredPlayer from the local ADP dataset."
  }
}

$walker = $players["kenneth-walker"]
Assert-Close $walker.Yahoo 21.0 "Kenneth Walker Yahoo ADP"
Assert-Close (Get-ConsensusAdp $walker) 20.3444444444444 "Kenneth Walker consensus ADP"
Assert-Close (Get-TargetAdp $walker) 20.705 "Kenneth Walker target ADP"

$chase = $players["ja-marr-chase"]
Assert-Close $chase.Yahoo 1.7 "Ja'Marr Chase Yahoo ADP"
Assert-Close (Get-ConsensusAdp $chase) 2.11111111111111 "Ja'Marr Chase consensus ADP"
Assert-Close (Get-TargetAdp $chase) 1.885 "Ja'Marr Chase target ADP"

if (-not $appSource.Contains("return player.adp.yahoo * yahooWeight + consensusAdp(player) * (1 - yahooWeight);")) {
  throw "The dashboard target-ADP implementation no longer uses a Yahoo-primary weighted average."
}

Write-Output "ADP validation passed: Kenneth Walker target 20.7 (Yahoo 21.0, consensus 20.3); Ja'Marr Chase target 1.9."

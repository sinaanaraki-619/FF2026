param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectionCsvPath,
  [string]$BoardPath,
  [string]$OutputPath
)

if ([string]::IsNullOrWhiteSpace($BoardPath)) {
  $BoardPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\data.js"
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\projections.js"
}
if (-not (Test-Path -LiteralPath $ProjectionCsvPath)) {
  throw "Projection CSV is inaccessible: $ProjectionCsvPath"
}

function Normalize-PlayerName {
  param([string]$Name)

  $formD = $Name.Normalize([Text.NormalizationForm]::FormD)
  $plain = -join ($formD.ToCharArray() | Where-Object {
    [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
  })
  return (($plain.ToLowerInvariant() -replace "[^a-z0-9]", "") -replace "(jr|sr|ii|iii|iv|v)$", "")
}

function Convert-ProjectionNumber {
  param([string]$Value)

  $number = 0.0
  if (-not [double]::TryParse($Value, [Globalization.NumberStyles]::Number, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    throw "Invalid projection number: $Value"
  }
  return $number
}

$board = Get-Content -LiteralPath $BoardPath -Raw
$playerPattern = '^\s*\["(?<id>[^"]+)","(?<name>[^"]+)","(?<position>[^"]+)",'
$boardPlayers = @{}
foreach ($match in [regex]::Matches($board, $playerPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
  $key = "$(Normalize-PlayerName $match.Groups["name"].Value)|$($match.Groups["position"].Value)"
  if ($boardPlayers.ContainsKey($key)) {
    throw "Duplicate normalized board player: $key"
  }
  $boardPlayers[$key] = [pscustomobject]@{
    Id = $match.Groups["id"].Value
    Name = $match.Groups["name"].Value
    Position = $match.Groups["position"].Value
  }
}

$projectionRows = Import-Csv -LiteralPath $ProjectionCsvPath
$sourcePositions = @($projectionRows.POS | Sort-Object -Unique)
$projectionByKey = @{}
foreach ($row in $projectionRows) {
  if ($row.POS -notin @("QB", "RB", "WR", "TE")) {
    continue
  }
  $key = "$(Normalize-PlayerName $row.PLAYER)|$($row.POS)"
  if ($projectionByKey.ContainsKey($key)) {
    throw "Duplicate normalized projection player: $key"
  }
  $projectionByKey[$key] = $row
}

$stats = @()
foreach ($key in $projectionByKey.Keys) {
  if (-not $boardPlayers.ContainsKey($key)) {
    continue
  }
  $source = $projectionByKey[$key]
  $player = $boardPlayers[$key]
  $stats += [ordered]@{
    id = $player.Id
    name = $player.Name
    position = $player.Position
    passAttempts = Convert-ProjectionNumber $source.PATT
    passYards = Convert-ProjectionNumber $source.PAYD
    passTouchdowns = Convert-ProjectionNumber $source.PATD
    interceptions = Convert-ProjectionNumber $source.INT
    rushAttempts = Convert-ProjectionNumber $source.RUATT
    rushYards = Convert-ProjectionNumber $source.RUYD
    rushTouchdowns = Convert-ProjectionNumber $source.RUTD
    receptions = Convert-ProjectionNumber $source.REC
    receivingYards = Convert-ProjectionNumber $source.RECYD
    receivingTouchdowns = Convert-ProjectionNumber $source.RETD
    fumbles = Convert-ProjectionNumber $source.FL
  }
}

$sourceTimestamp = (Get-Item -LiteralPath $ProjectionCsvPath).LastWriteTimeUtc.ToString("o")
$playerLines = $stats | Sort-Object id | ForEach-Object {
  (ConvertTo-Json -InputObject $_ -Compress) -replace "\\u0027", "'"
}
$positionsJson = ConvertTo-Json -InputObject $sourcePositions -Compress
$content = @"
/*
 * Generated from the supplied NFL_Season_Projections__OFF_.csv attachment.
 * The source contains $($projectionRows.Count) rows limited to position(s): $($sourcePositions -join ", ").
 */
(function () {
  const players = [
    $($playerLines -join ",`n    ")
  ];

  window.DRAFT_COMPASS_PROJECTIONS = {
    meta: {
      sourceName: "Supplied NFL offensive projections CSV",
      sourceFileTimestamp: "$sourceTimestamp",
      sourceRecordCount: $($projectionRows.Count),
      sourcePositions: $positionsJson,
      matchedBoardRecordCount: $($stats.Count),
      scoringLimitation: "The supplied file has no first-down fields or game-level yardage splits, so first-down and 100/150/200-yard bonus points are excluded."
    },
    players: Object.fromEntries(players.map((player) => [player.id, player]))
  };
}());
"@

Set-Content -LiteralPath $OutputPath -Value $content -Encoding utf8
Write-Output "Wrote $($stats.Count) matched offensive projection records from $($projectionRows.Count) source rows to $OutputPath. Source positions: $($sourcePositions -join ', ')."

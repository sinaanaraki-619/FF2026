param(
  [Parameter(Mandatory = $true)]
  [string]$GuruCsvPath,
  [Parameter(Mandatory = $true)]
  [string]$SupplementalAdpPath,
  [string]$OutputPath,
  [string]$RefreshedAt = "2026-07-30T11:19:00-07:00"
)

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\assets\data.js"
}

function Normalize-PlayerName {
  param([string]$Name)

  $formD = $Name.Normalize([Text.NormalizationForm]::FormD)
  $plain = -join ($formD.ToCharArray() | Where-Object {
    [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
  })
  return (($plain.ToLowerInvariant() -replace "[^a-z0-9]", "") -replace "(jr|sr|ii|iii|iv|v|dst)$", "")
}

function Convert-SourceNumber {
  param([string]$Value)

  $number = 0.0
  if ([double]::TryParse($Value, [Globalization.NumberStyles]::Number, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return $number
  }
  return $null
}

$guru = Import-Csv -LiteralPath $GuruCsvPath | Sort-Object { [int]$_.Rank }
$lines = Get-Content -LiteralPath $SupplementalAdpPath
$index = [array]::FindIndex([string[]]$lines, [Predicate[string]]{ param($line) $line.Trim() -eq "Real-Time" }) + 1
if ($index -eq 0) {
  throw "Supplemental ADP header was not found."
}

$adpByName = @{}
while ($index -lt $lines.Count) {
  if ($lines[$index] -notmatch "^\d+$") {
    break
  }

  $sourceRank = $lines[$index++]
  $player = $lines[$index++]
  $team = $lines[$index]
  if ($team -match "^(QB|RB|WR|TE|K|DST)\d+$") {
    $team = ""
    $position = $lines[$index++]
  } else {
    $index++
    $position = $lines[$index++]
  }
  if ($index + 4 -ge $lines.Count) {
    throw "Incomplete supplemental row for $player."
  }

  $key = Normalize-PlayerName $player
  if ($adpByName.ContainsKey($key)) {
    throw "Duplicate normalized supplemental player name: $key"
  }
  $adpByName[$key] = [pscustomobject]@{
    Player = $player
    Position = ($position -replace "\d+$", "")
    Yahoo = Convert-SourceNumber $lines[$index++]
    Sleeper = Convert-SourceNumber $lines[$index++]
    RtSports = Convert-SourceNumber $lines[$index++]
    Average = Convert-SourceNumber $lines[$index++]
    RealTime = Convert-SourceNumber $lines[$index++]
  }
}

$knownUnmatchedGuruKeys = @("brycelance", "carolinapanthers")
$records = @()
$excludedGuru = @()
$recordIds = [System.Collections.Generic.HashSet[string]]::new()

foreach ($guruPlayer in $guru) {
  $key = Normalize-PlayerName $guruPlayer.Player
  if (-not $adpByName.ContainsKey($key)) {
    if ($knownUnmatchedGuruKeys -contains $key) {
      $excludedGuru += $guruPlayer.Player
      continue
    }
    throw "No supplemental ADP row for Guru player: $($guruPlayer.Player)"
  }

  $adp = $adpByName[$key]
  if ($adp.Position -notin @("QB", "RB", "WR", "TE", "K", "DST")) {
    throw "Invalid supplemental position for $($guruPlayer.Player): $($adp.Position)"
  }
  if (-not $recordIds.Add($key)) {
    throw "Duplicate generated player id: $key"
  }

  $records += [pscustomobject]@{
    id = $key
    name = $guruPlayer.Player
    position = $adp.Position
    team = $guruPlayer.Team
    rank = [int]$guruPlayer.Rank
    tier = [math]::Ceiling([int]$guruPlayer.Rank / 12)
    adp = [ordered]@{
      yahoo = $adp.Yahoo
      sleeper = $adp.Sleeper
      rtSports = $adp.RtSports
      average = $adp.Average
      realTime = $adp.RealTime
    }
  }
}

$expectedExcluded = "Bryce Lance|Carolina Panthers"
if ($records.Count -ne 198 -or (($excludedGuru | Sort-Object) -join "|") -ne $expectedExcluded) {
  throw "Unexpected source join result: $($records.Count) records; excluded: $($excludedGuru -join ', ')"
}

$playerLines = $records | ForEach-Object {
  (ConvertTo-Json -InputObject @($_.id, $_.name, $_.position, $_.team, $_.adp.yahoo, $_.adp.sleeper, $_.adp.rtSports, $_.adp.average, $_.adp.realTime) -Compress) -replace "\\u0027", "'"
}
$rankLines = $records | ForEach-Object {
  ConvertTo-Json -InputObject @($_.id, $_.rank, $_.tier) -Compress
}

$content = @"
/*
 * Source-backed PPR data generated from the supplied Fantasy Guru top-200 CSV
 * and supplemental Yahoo/Sleeper/RTSports/AVG/Real-Time table.
 */
(function () {
  const players = [
    $($playerLines -join ",`n    ")
  ];

  const pprOrder = [
    $($rankLines -join ",`n    ")
  ];

  // No half-PPR export was supplied; retain a distinct provisional board.
  const halfPprOrder = pprOrder.map((entry) => [...entry]);

  const playerMap = Object.fromEntries(players.map(([id, name, position, team, yahoo, sleeper, rtSports, average, realTime]) => [
    id, { id, name, position, team, adp: { yahoo, sleeper, rtSports, average, realTime } }
  ]));

  const toRankings = (entries) => entries.map(([id, rank, tier]) => ({
    ...playerMap[id], rank, projectedPoints: null, tier
  }));

  window.DRAFT_DASHBOARD_DATA = {
    meta: {
      dataLastRefreshed: "$RefreshedAt",
      isSampleData: false,
      sourceRecordCount: $($records.Count),
      excludedGuruRecords: $(ConvertTo-Json -InputObject $excludedGuru -Compress),
      leagueSeason: 2026
    },
    sources: {
      yahoo: { name: "Yahoo", role: "Primary target input", refreshedAt: "$RefreshedAt", weight: 0.55 },
      sleeper: { name: "Sleeper", role: "Included in supplied AVG", refreshedAt: "$RefreshedAt", weight: 0.2 },
      rtSports: { name: "RTSports", role: "Included in supplied AVG", refreshedAt: "$RefreshedAt", weight: 0.15 },
      realTime: { name: "Real-Time", role: "Supplemental comparison", refreshedAt: "$RefreshedAt", weight: 0.1 }
    },
    rankings: {
      ppr: {
        label: "PPR",
        provisional: false,
        items: toRankings(pprOrder)
      },
      halfPpr: {
        label: "Half-PPR",
        provisional: true,
        note: "This provisional half-PPR board reuses the supplied PPR order. Replace it with a dedicated half-PPR export before drafting.",
        items: toRankings(halfPprOrder)
      }
    }
  };
}());
"@

Set-Content -LiteralPath $OutputPath -Value $content -Encoding utf8
Write-Output "Wrote $($records.Count) source-backed player records to $OutputPath. Excluded unmatched Guru record: $($excludedGuru -join ', ')."

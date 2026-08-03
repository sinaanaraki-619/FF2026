param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$guard = Join-Path $RepositoryRoot "scripts\draftsharks-schedule-guard.py"
$refresh = Join-Path $RepositoryRoot "scripts\refresh-draftsharks-snapshot.py"
$fixture = Join-Path $RepositoryRoot "scripts\fixtures\draftsharks-public-table.html"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "draft-compass-schedule-$PID"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
  $checks = @(
    @{ Time = "2026-07-03T15:00:00Z"; Expected = "allowed" },
    @{ Time = "2026-07-03T16:00:00Z"; Expected = "skipped" },
    @{ Time = "2026-01-03T16:00:00Z"; Expected = "allowed" },
    @{ Time = "2026-01-03T15:00:00Z"; Expected = "skipped" }
  )
  foreach ($check in $checks) {
    $result = python $guard --now $check.Time
    if ($LASTEXITCODE -ne 0 -or -not $result.Contains("refresh $($check.Expected)")) {
      throw "Schedule guard did not $($check.Expected) at $($check.Time): $result"
    }
  }

  $snapshotPath = Join-Path $tempRoot "snapshots.json"
  $reportPath = Join-Path $tempRoot "report.md"
  Set-Content -LiteralPath $snapshotPath -Value '{"snapshots":[]}' -NoNewline
  python $refresh --scoring ppr --teams 12 --snapshot-path $snapshotPath --report-path $reportPath --html-path $fixture
  if ($LASTEXITCODE -ne 0) {
    throw "Fixture refresh parser did not succeed."
  }
  $snapshot = Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json
  $record = $snapshot.snapshots[0]
  if ($record.sourceTimestampStatus -ne "validated" -or $record.sourceUpdatedAt -ne "2026-08-03T08:00:00-07:00" -or $record.recordCount -ne 20) {
    throw "Validated source timestamp or snapshot record count is incorrect."
  }
  if (-not (Get-Content -LiteralPath $reportPath -Raw).Contains("Source page last updated: 2026-08-03T08:00:00-07:00")) {
    throw "Refresh report omitted the validated source timestamp."
  }

  $untimedFixture = Join-Path $tempRoot "untimed-table.html"
  (Get-Content -LiteralPath $fixture -Raw) -replace '<p>Last updated: 2026-08-03T08:00:00-07:00</p>', '' |
    Set-Content -LiteralPath $untimedFixture -NoNewline
  $untimedSnapshotPath = Join-Path $tempRoot "untimed-snapshots.json"
  $untimedReportPath = Join-Path $tempRoot "untimed-report.md"
  Set-Content -LiteralPath $untimedSnapshotPath -Value '{"snapshots":[]}' -NoNewline
  python $refresh --scoring half-ppr --teams 12 --snapshot-path $untimedSnapshotPath --report-path $untimedReportPath --html-path $untimedFixture
  if ($LASTEXITCODE -ne 0) {
    throw "Untimed fixture refresh parser did not succeed."
  }
  $untimedRecord = (Get-Content -LiteralPath $untimedSnapshotPath -Raw | ConvertFrom-Json).snapshots[0]
  if ($untimedRecord.sourceTimestampStatus -ne "unavailable" -or $null -ne $untimedRecord.sourceUpdatedAt) {
    throw "Untimed public response did not retain the explicit unavailable source timestamp state."
  }

  Write-Output "DraftSharks schedule validation passed: PDT/PST 8 AM guard, validated/unavailable source timestamp states, and 20-record public-table fixture."
} finally {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

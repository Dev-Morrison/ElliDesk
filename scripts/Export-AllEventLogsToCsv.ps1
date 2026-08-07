<#
.SYNOPSIS
    Batch version of Export-EventLogsToCsv.ps1 - walks every date-named
    subfolder under -RootFolder and converts all four .evtx files in each to
    CSV, ready to upload at the ElliDesk "Import Event Logs" page.

.DESCRIPTION
    Built for long unattended runs (a single large Security.evtx can take
    many hours to render), so it's designed around a crash or reboot
    happening partway through a multi-day batch:

      - Resumable: an output CSV that already exists (and is non-empty) is
        skipped, so re-running the script after an interruption only
        redoes the one job that was in progress, not everything before it.
      - Atomic writes: each log is exported to a ".partial" temp file and
        only renamed to its final name after Export-Csv finishes
        successfully. A file that got killed mid-write never looks
        "done" to the resume check above.
      - One failure doesn't stop the batch: each log export is wrapped in
        its own try/catch, so a locked or corrupt .evtx is logged and
        skipped rather than aborting the rest of the run.
      - A persistent, timestamped log file is written alongside the CSVs so
        progress can be checked remotely (RDP, file share, whatever) without
        needing to be watching a live console.
      - Periodic "still working" heartbeat lines are logged during long
        exports, since Get-WinEvent gives no feedback on its own and hours
        of console silence is otherwise indistinguishable from a hang.
      - Prevents the machine from sleeping for the duration of the run
        (via SetThreadExecutionState) as a safety net on top of whatever
        power settings are already configured.

    Run this ON the domain controller (or a machine with the same server
    roles installed) - event message text is resolved using locally
    registered provider manifests, so running it elsewhere can leave some
    AD/DC-specific messages blank or generic.

.PARAMETER RootFolder
    Parent folder containing the date-named export folders, e.g.
    C:\EventLogExports, where C:\EventLogExports\2026-06-19\Security.evtx
    etc. exist.

.PARAMETER OutputFolder
    Where to write the resulting CSVs (all in one flat folder, named
    "<LogType>-<dateFolder>.csv") and the run log. Defaults to a "_csv"
    folder created inside -RootFolder.

.PARAMETER LogTypes
    Which logs to convert. Defaults to all four. Narrow this if you want a
    separate run dedicated to just Security, for example.

.PARAMETER SkipMessages
    Skip rendering the human-readable Message text. Message rendering is
    almost certainly why Security.evtx took 13 hours - Get-WinEvent only
    does that expensive lookup when the Message property is actually
    accessed, so this genuinely skips the slow part rather than just
    hiding it. Trade-off: imported events will have an empty message body
    in ElliDesk. Worth trying on one folder first to see how much time it
    actually saves before committing a multi-day run to it.

.PARAMETER Force
    Re-export even if an output CSV already exists for that log/date.

.PARAMETER Since
    Only process date folders named on or after this date (folders are
    named YYYY-MM-DD, so plain string comparison works). Useful for a
    smaller first pass - e.g. -Since "2026-07-21" for just the last couple
    of weeks - to get a real per-folder timing baseline before committing
    to the full backlog.

.PARAMETER OldestFirst
    Process folders in chronological order instead of the default
    newest-first. Newest-first is the default because if a multi-day run
    doesn't get through everything, you want the most recent (most
    operationally relevant) data captured first, not left for last.

.EXAMPLE
    .\Export-AllEventLogsToCsv.ps1 -RootFolder "D:\EventLogExports"

.EXAMPLE
    .\Export-AllEventLogsToCsv.ps1 -RootFolder "D:\EventLogExports" -LogTypes Security -SkipMessages

.EXAMPLE
    .\Export-AllEventLogsToCsv.ps1 -RootFolder "D:\EventLogExports" -Since "2026-07-21"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$RootFolder,

    [string]$OutputFolder,

    [ValidateSet('Application', 'Security', 'Setup', 'System')]
    [string[]]$LogTypes = @('Application', 'Security', 'Setup', 'System'),

    [switch]$SkipMessages,

    [switch]$Force,

    [string]$Since,

    [switch]$OldestFirst
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $RootFolder)) {
    throw "RootFolder not found: $RootFolder"
}

if (-not $OutputFolder) {
    $OutputFolder = Join-Path $RootFolder '_csv'
}
if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
}

$logFilePath = Join-Path $OutputFolder ("run-log-{0}.txt" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    Add-Content -Path $logFilePath -Value $line
}

# --- Prevent sleep for the duration of the run ---------------------------
$sleepBlocked = $false
try {
    Add-Type -Name Power -Namespace ElliDeskNative -MemberDefinition @'
[DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
public static extern uint SetThreadExecutionState(uint esFlags);
'@ -ErrorAction Stop

    # Cast from a string, not a bare hex literal: PowerShell tokenizes an
    # unsuffixed hex literal like 0x80000000 as a signed Int32 first (which
    # overflows to a negative number), and [uint32] then rejects converting
    # that negative value - even though 0x80000000 fits UInt32 just fine.
    $ES_CONTINUOUS = [uint32]"0x80000000"
    $ES_SYSTEM_REQUIRED = [uint32]"0x00000001"
    $ES_AWAYMODE_REQUIRED = [uint32]"0x00000040"

    [ElliDeskNative.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_AWAYMODE_REQUIRED) | Out-Null
    $sleepBlocked = $true
    Write-Log "Sleep prevention enabled for this run."
} catch {
    Write-Log "Could not enable sleep prevention ($($_.Exception.Message)) - make sure this machine's power settings are already set to never sleep."
}

Write-Log "Starting batch export."
Write-Log "  Root:      $RootFolder"
Write-Log "  Output:    $OutputFolder"
Write-Log "  Log types: $($LogTypes -join ', ')"
Write-Log "  Order:     $(if ($OldestFirst) { 'oldest first' } else { 'newest first' })"
if ($Since) { Write-Log "  Since:     $Since" }
if ($SkipMessages) { Write-Log "  Skipping message text (speed mode)." }
if ($Force) { Write-Log "  Force: re-exporting even if a CSV already exists." }

$dateFolders = Get-ChildItem -Path $RootFolder -Directory

if ($Since) {
    $dateFolders = $dateFolders | Where-Object { $_.Name -ge $Since }
}

# Folder names are YYYY-MM-DD, so plain string sort is also a correct date
# sort - descending (newest first) by default, see -OldestFirst above.
$dateFolders = if ($OldestFirst) {
    $dateFolders | Sort-Object Name
} else {
    $dateFolders | Sort-Object Name -Descending
}

Write-Log "Found $($dateFolders.Count) date folder(s) to process."

$overallStart = Get-Date
$totalJobs = 0
$completedJobs = 0
$failedJobs = 0
$skippedJobs = 0
$emptyJobs = 0

foreach ($dateFolder in $dateFolders) {
    foreach ($logType in $LogTypes) {
        $evtxPath = Join-Path $dateFolder.FullName "$logType.evtx"

        if (-not (Test-Path $evtxPath)) {
            continue
        }

        $totalJobs++
        $outputPath = Join-Path $OutputFolder "$logType-$($dateFolder.Name).csv"

        if (-not $Force -and (Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 0) {
            Write-Log "SKIP  $logType / $($dateFolder.Name) - already exported"
            $skippedJobs++
            continue
        }

        Write-Log "START $logType / $($dateFolder.Name) -> $(Split-Path -Leaf $outputPath)"
        $jobStart = Get-Date
        $tempPath = "$outputPath.partial"
        $eventCount = 0

        try {
            Get-WinEvent -Path $evtxPath -ErrorAction Stop |
                ForEach-Object {
                    $eventCount++
                    if ($eventCount % 25000 -eq 0) {
                        $elapsedMin = [math]::Round(((Get-Date) - $jobStart).TotalMinutes, 1)
                        Write-Log "  ... $logType / $($dateFolder.Name): $eventCount events so far ($elapsedMin min elapsed)"
                    }
                    $_
                } |
                Select-Object RecordId,
                    @{Name = 'TimeCreated'; Expression = { $_.TimeCreated.ToString('o') } },
                    Id,
                    LevelDisplayName,
                    ProviderName,
                    LogName,
                    MachineName,
                    UserId,
                    @{Name = 'Message'; Expression = {
                        if ($SkipMessages) { '' } else { ($_.Message -replace "`r`n", ' ') -replace "`n", ' ' }
                    } } |
                Export-Csv -Path $tempPath -NoTypeInformation -Encoding UTF8

            Move-Item -Path $tempPath -Destination $outputPath -Force

            $jobElapsedMin = [math]::Round(((Get-Date) - $jobStart).TotalMinutes, 1)
            Write-Log "DONE  $logType / $($dateFolder.Name) - $eventCount events in $jobElapsedMin min"
            $completedJobs++
        } catch {
            if ($_.Exception.Message -match 'No events were found') {
                Write-Log "EMPTY $logType / $($dateFolder.Name) - 0 events, nothing to export"
                $emptyJobs++
            } else {
                Write-Log "FAIL  $logType / $($dateFolder.Name) - $($_.Exception.Message)"
                $failedJobs++
            }
            if (Test-Path $tempPath) {
                Remove-Item $tempPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

if ($sleepBlocked) {
    [ElliDeskNative.Power]::SetThreadExecutionState([uint32]"0x80000000") | Out-Null
}

$overallElapsedHrs = [math]::Round(((Get-Date) - $overallStart).TotalHours, 2)
Write-Log "Batch complete in $overallElapsedHrs hours. $completedJobs done, $skippedJobs skipped, $emptyJobs empty, $failedJobs failed (of $totalJobs total)."
Write-Log "Log file: $logFilePath"
Write-Log "Upload the CSVs in $OutputFolder at the ElliDesk 'Import Event Logs' page."

if ($failedJobs -gt 0) {
    Write-Log "Some jobs failed - re-run this same command later and it will only retry what's missing."
}

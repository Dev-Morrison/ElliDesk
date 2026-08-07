<#
.SYNOPSIS
    Converts exported Windows Event Log (.evtx) files to CSV for import into ElliDesk.

.DESCRIPTION
    Looks for Application.evtx, Security.evtx, Setup.evtx, and System.evtx inside
    -SourceFolder (skipping any that aren't present) and writes one CSV per log
    into -OutputFolder, ready to upload at the ElliDesk "Import Event Logs" page.

    Run this ON the domain controller (or a machine with the same server roles
    installed) rather than a random workstation - event message text is
    resolved using locally registered provider manifests, so running it
    elsewhere can leave some AD/DC-specific messages blank or generic.

    TimeCreated is written in ISO 8601 (round-trip format) so it parses
    unambiguously regardless of the exporting machine's regional settings -
    earlier exports used PowerShell's culture-formatted date/time instead,
    which ElliDesk still supports on import, but this format is preferred
    going forward.

.PARAMETER SourceFolder
    Folder containing the .evtx files for one export date, e.g.
    C:\EventLogExports\2026-06-19

.PARAMETER OutputFolder
    Where to write the resulting CSV files. Created if it doesn't exist.

.EXAMPLE
    .\Export-EventLogsToCsv.ps1 -SourceFolder "C:\EventLogExports\2026-06-19" -OutputFolder "C:\EventLogExports\2026-06-19\csv"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SourceFolder,

    [Parameter(Mandatory = $true)]
    [string]$OutputFolder
)

$ErrorActionPreference = 'Stop'

$logTypes = 'Application', 'Security', 'Setup', 'System'
$dateTag = Split-Path -Leaf $SourceFolder

if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
}

foreach ($logType in $logTypes) {
    $evtxPath = Join-Path $SourceFolder "$logType.evtx"

    if (-not (Test-Path $evtxPath)) {
        Write-Warning "Skipping $logType - $evtxPath not found."
        continue
    }

    $outputPath = Join-Path $OutputFolder "$logType-$dateTag.csv"
    Write-Host "Exporting $logType.evtx -> $outputPath"

    try {
        Get-WinEvent -Path $evtxPath -ErrorAction Stop |
            Select-Object RecordId,
                @{Name = 'TimeCreated'; Expression = { $_.TimeCreated.ToString('o') } },
                Id,
                LevelDisplayName,
                ProviderName,
                LogName,
                MachineName,
                UserId,
                @{Name = 'Message'; Expression = { ($_.Message -replace "`r`n", ' ') -replace "`n", ' ' } } |
            Export-Csv -Path $outputPath -NoTypeInformation -Encoding UTF8

        Write-Host "  Done."
    } catch {
        Write-Warning "  Failed to export $logType`: $($_.Exception.Message)"
    }
}

Write-Host "`nAll done. Upload the CSV files in $OutputFolder at the ElliDesk 'Import Event Logs' page."

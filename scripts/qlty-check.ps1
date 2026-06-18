# Run Qlty checks without loading the PowerShell profile (safe for Cursor agent + CI).
param(
    [switch]$All,
    [switch]$Fix,
    [string[]]$Paths = @()
)

$qlty = Join-Path $env:USERPROFILE '.qlty\bin\qlty.exe'
if (-not (Test-Path $qlty)) {
    Write-Error "qlty not found at $qlty — install from https://qlty.sh"
    exit 1
}

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$args = @('check', '--summary')
if ($All) { $args += '--all' }
if ($Fix) { $args += '--fix' }
if ($Paths.Count -gt 0) { $args += $Paths }

& $qlty @args
exit $LASTEXITCODE

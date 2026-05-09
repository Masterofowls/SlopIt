# fly-set-telegram.ps1
# Set Telegram secrets on the slopit-api Fly.io app.
# Run once after deploying — never commit these values to git.
#
# Usage:
#   .\scripts\fly-set-telegram.ps1
#
# Then redeploy to pick up the new secrets:
#   flyctl deploy

param(
    [string]$BotToken     = $env:TELEGRAM_BOT_TOKEN,
    [string]$ClientSecret = $env:TELEGRAM_CLIENT_SECRET
)

if (-not $BotToken) {
    $BotToken = Read-Host -Prompt "Enter TELEGRAM_BOT_TOKEN"
}
if (-not $ClientSecret) {
    $ClientSecret = Read-Host -Prompt "Enter TELEGRAM_CLIENT_SECRET"
}

Write-Host "Setting Telegram secrets on slopit-api..." -ForegroundColor Cyan

flyctl secrets set `
    TELEGRAM_BOT_TOKEN="$BotToken" `
    TELEGRAM_CLIENT_SECRET="$ClientSecret" `
    --app slopit-api

if ($LASTEXITCODE -ne 0) {
    Write-Error "flyctl secrets set failed (exit code $LASTEXITCODE)."
    exit $LASTEXITCODE
}

Write-Host "✓ Telegram secrets set. Redeploy with: flyctl deploy" -ForegroundColor Green

#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# SlopIt — Set Clerk secret on Fly.io
#
# Usage:
#   .\scripts\fly-set-clerk.ps1 -SecretKey "sk_test_..."
#
# Find your secret key: Clerk Dashboard → API Keys → Secret keys
# Public values (CLERK_JWKS_URL, CLERK_PUBLISHABLE_KEY) are already set in
# fly.toml [env] and don't need to be set as secrets.
# ─────────────────────────────────────────────────────────────────────────────
param(
    [Parameter(Mandatory)]
    [string]$SecretKey
)

Write-Host "Setting CLERK_SECRET_KEY on slopit-api..." -ForegroundColor Cyan
flyctl secrets set "CLERK_SECRET_KEY=$SecretKey" --app slopit-api

Write-Host ""
Write-Host "Done. Fly.io will restart the app automatically." -ForegroundColor Green
Write-Host ""
Write-Host "Public Clerk values already set in fly.toml [env]:"
Write-Host "  CLERK_PUBLISHABLE_KEY  = pk_test_cXVpY2stYnVsbGRvZy05MS5jbGVyay5hY2NvdW50cy5kZXYk"
Write-Host "  CLERK_JWKS_URL         = https://quick-bulldog-91.clerk.accounts.dev/.well-known/jwks.json"
Write-Host "  CLERK_FRONTEND_API_URL = https://quick-bulldog-91.clerk.accounts.dev"
Write-Host ""
Write-Host "Smoke-test connectivity: https://slopit-api.fly.dev/tests"

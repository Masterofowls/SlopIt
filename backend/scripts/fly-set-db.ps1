#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# SlopIt — Set Supabase DATABASE_URL secret on Fly.io and deploy
#
# Usage:
#   .\scripts\fly-set-db.ps1 -Password "your-supabase-db-password"
#
# Find your password: supabase.com → your project → Settings → Database
# Click the "Reveal" icon next to "Database password".
#
# The URL below uses the Transaction Pooler (port 6543) — Fly.io workers
# restart frequently so a pool of short-lived connections is ideal.
# ─────────────────────────────────────────────────────────────────────────────
param(
    [Parameter(Mandatory)]
    [string]$Password
)

$DbUrl = "postgres://postgres.jfwltpzqfavpwrudgjhg:${Password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require"

Write-Host "Setting DATABASE_URL on slopit-api..." -ForegroundColor Cyan
flyctl secrets set "DATABASE_URL=$DbUrl" --app slopit-api

Write-Host ""
Write-Host "Deploying slopit-api to Fly.io (remote build)..." -ForegroundColor Cyan
flyctl deploy --remote-only --wait-timeout 300 --app slopit-api

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Health check: https://slopit-api.fly.dev/api/v1/system/status"
Write-Host "Admin panel:  https://slopit-api.fly.dev/admin/"
Write-Host ""
Write-Host "Create your superuser:"
Write-Host "  flyctl ssh console --app slopit-api"
Write-Host "  cd /app && python src/slopit/manage.py createsuperuser"

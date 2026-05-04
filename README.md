# SlopIt Monorepo

This repository now uses a split layout for independent Fly.io deployments.

## Structure

- backend: Django API/backend project
- frontend: future frontend app (separate Fly.io project)

## Backend

```powershell
cd backend
uv pip install -e ".[dev]"
python src/slopit/manage.py migrate
python src/slopit/manage.py runserver
```

## Deploy

- Backend deploy config: backend/fly.toml
- GitHub Actions deploy workflow uses backend/fly.toml

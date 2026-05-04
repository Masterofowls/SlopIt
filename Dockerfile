# syntax=docker/dockerfile:1.7
# ─── Builder stage ────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_SYSTEM_PYTHON=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv pip install --system --no-cache .

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl && \
    rm -rf /var/lib/apt/lists/* && \
    addgroup --system app && adduser --system --ingroup app app

WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --chown=app:app . .

# Create dirs and run collectstatic at build time so static files are baked
# into the image. The release_command only runs migrate (needs a live DB).
# A dummy SECRET_KEY is sufficient — collectstatic never touches the DB.
RUN mkdir -p /app/staticfiles /app/media && chown -R app:app /app
RUN DJANGO_SECRET_KEY=build-only-dummy-key \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    DJANGO_ALLOWED_HOSTS=localhost \
    DATABASE_URL=postgres://x:x@localhost/x \
    python src/slopit/manage.py collectstatic --noinput

USER app

EXPOSE 8000

# Healthcheck endpoint — implemented in Stage 4 as /api/system/status
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail --silent http://localhost:8000/api/v1/system/status || exit 1

# Migrate happens in release_command (see fly.toml). Collectstatic runs above.
CMD ["gunicorn", "config.wsgi:application", \
     "--chdir", "src/slopit", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]

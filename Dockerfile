# Nexventory API — production-oriented image (flat app layout: main.py at /app)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Non-root user (no extra packages — health checks use Python stdlib)
RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app --no-create-home app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ .
# Alembic migrations (run: docker compose exec api alembic upgrade head)
COPY alembic.ini .
COPY alembic ./alembic
RUN chown -R app:app /app

USER app

EXPOSE 8000

# Liveness: API process responds (readiness with DB is in Compose /health/ready)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

# Trust X-Forwarded-* from nginx on the Docker network
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

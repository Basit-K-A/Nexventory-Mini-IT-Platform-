"""
Application entry point.

main.py should stay small:
- create the FastAPI app
- register routers
- run startup tasks (e.g. create tables, Redis)
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import models  # noqa: F401 — registers ORM models with Base.metadata
from core.limiter import limiter
from core.redis_client import close_redis, init_redis
from core.schema_guard import ensure_schema
from database import Base, check_database_connection, engine
from logging_config import setup_logging
from middleware.exception_handlers import register_exception_handlers
from middleware.request_logging import RequestLoggingMiddleware
from middleware.security_headers import SecurityHeadersMiddleware
from routers import audit, auth, dashboard, devices, events, health, tickets, users

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_redis()
    try:
        check_database_connection()
        Base.metadata.create_all(bind=engine)
        # Reconcile additive column drift on pre-existing tables (create_all won't).
        ensure_schema(engine)
        logger.info("Database connected and tables are ready.")
    except OperationalError as exc:
        from urllib.parse import urlparse

        from database import DATABASE_URL

        parsed = urlparse(DATABASE_URL)
        logger.error(
            "Database unavailable at startup — API will run but DB routes will fail. "
            "host=%s port=%s database=%s user=%s. Error: %s",
            parsed.hostname,
            parsed.port or 5432,
            (parsed.path or "").lstrip("/"),
            parsed.username,
            exc,
        )
    yield
    close_redis()


app = FastAPI(
    title="Nexventory API",
    description=(
        "Production-style internal IT platform API: JWT auth, RBAC, audit logging, "
        "paginated list endpoints, Redis caching, and background tasks."
    ),
    version="1.2.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "auth", "description": "Registration, login, token refresh"},
        {"name": "users", "description": "User administration (admin)"},
        {"name": "devices", "description": "Device inventory CRUD and listing"},
        {"name": "events", "description": "Device event log (legacy — use tickets)"},
        {"name": "tickets", "description": "IT support tickets"},
        {"name": "audit", "description": "Security audit trail (admin/analyst)"},
        {"name": "dashboard", "description": "Security monitoring summaries"},
        {"name": "health", "description": "Liveness and readiness probes"},
    ],
)

app.state.limiter = limiter
register_exception_handlers(app)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
app.add_middleware(RequestLoggingMiddleware)

_cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:4173,http://127.0.0.1:4173,"
    "http://localhost,http://127.0.0.1",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(devices.router)
app.include_router(events.router)
app.include_router(tickets.router)

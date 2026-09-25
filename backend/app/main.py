"""Application factory, CORS, and lifespan (schema init)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_schema
from app.routes import router


def _parse_origins(raw: str) -> list[str]:
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or ["*"]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_schema()
    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title="Quick-Poll Room",
        description="Zero-authentication live polling API",
        version="1.0.0",
        lifespan=lifespan,
    )

    allow_origins = _parse_origins(
        os.getenv("CORS_ORIGINS", "*")
    )
    allow_origin_regex = os.getenv("CORS_ORIGIN_REGEX") or None

    application.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)


    @application.get("/health", tags=["ops"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()

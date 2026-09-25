"""REST endpoints for poll creation, retrieval, and voting."""

from __future__ import annotations

import asyncio
import json
import secrets
import sqlite3
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.database import create_poll, fetch_poll, get_connection, increment_vote
from app.models import CreatePollRequest, PollResponse, VoteRequest

router = APIRouter(prefix="/api")

_poll_listeners: dict[str, set[asyncio.Event]] = {}


def _notify_poll_updated(poll_id: str) -> None:
    listeners = _poll_listeners.get(poll_id)
    if listeners:
        for event in list(listeners):
            event.set()


def _new_poll_id() -> str:
    # token_urlsafe(6) yields 8 URL-safe characters, matching VARCHAR(8).
    return secrets.token_urlsafe(6)[:8]


def _to_response(poll: dict[str, Any]) -> PollResponse:
    return PollResponse.model_validate(poll)


@router.post(
    "/polls",
    response_model=PollResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_poll_endpoint(payload: CreatePollRequest) -> PollResponse:
    last_error: Exception | None = None
    for _ in range(5):
        poll_id = _new_poll_id()
        try:
            poll = create_poll(
                poll_id,
                payload.question,
                payload.options,
                payload.expires_in_minutes,
            )
            return _to_response(poll)
        except sqlite3.IntegrityError as exc:
            last_error = exc
            continue
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Unable to allocate a unique poll id. Please retry.",
    ) from last_error


@router.get("/polls/{poll_id}", response_model=PollResponse)
def get_poll_endpoint(poll_id: str) -> PollResponse:
    if not poll_id or len(poll_id) > 8:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )
    with get_connection() as conn:
        poll = fetch_poll(conn, poll_id)
    if poll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )
    return _to_response(poll)


@router.get("/polls/{poll_id}/stream")
async def stream_poll_updates(poll_id: str, request: Request):
    if not poll_id or len(poll_id) > 8:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )
    with get_connection() as conn:
        initial_poll = fetch_poll(conn, poll_id)
    if initial_poll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )

    async def event_generator():
        event = asyncio.Event()
        if poll_id not in _poll_listeners:
            _poll_listeners[poll_id] = set()
        _poll_listeners[poll_id].add(event)

        try:
            # Send current state on connection
            data = json.dumps(_to_response(initial_poll).model_dump())
            yield f"data: {data}\n\n"

            loop = asyncio.get_running_loop()
            start_time = loop.time()

            while True:
                if await request.is_disconnected():
                    break
                # Gracefully cycle stream every 45s so browser auto-reconnects and server reloads don't hang
                if loop.time() - start_time > 45:
                    break

                try:
                    await asyncio.wait_for(event.wait(), timeout=10.0)
                    event.clear()
                    with get_connection() as conn:
                        poll = fetch_poll(conn, poll_id)
                    if poll:
                        data = json.dumps(_to_response(poll).model_dump())
                        yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            if poll_id in _poll_listeners:
                _poll_listeners[poll_id].discard(event)
                if not _poll_listeners[poll_id]:
                    del _poll_listeners[poll_id]


    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/polls/{poll_id}/vote", response_model=PollResponse)
def vote_endpoint(poll_id: str, payload: VoteRequest) -> PollResponse:
    result = increment_vote(poll_id, payload.option_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )
    if result.get("error") == "poll_expired":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This poll has expired and is no longer accepting votes.",
        )
    if result.get("error") == "option_not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Option not found for this poll",
        )

    _notify_poll_updated(poll_id)
    return _to_response(result)


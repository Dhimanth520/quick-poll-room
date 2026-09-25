"""SQLite access, schema bootstrap, and poll persistence helpers."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "polls.db"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB_PATH)))


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(
        str(DB_PATH),
        timeout=15,
        isolation_level=None,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


def init_schema() -> None:
    """Create tables if they do not already exist."""
    with get_connection() as conn:
        conn.execute("BEGIN")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS polls (
                id VARCHAR(8) PRIMARY KEY,
                question TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NULL
            )
            """
        )
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(polls)").fetchall()]
        if "expires_at" not in columns:
            conn.execute("ALTER TABLE polls ADD COLUMN expires_at TEXT NULL")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                poll_id VARCHAR(8) NOT NULL,
                option_text TEXT NOT NULL,
                votes INTEGER DEFAULT 0,
                FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_options_poll_id ON options(poll_id)"
        )
        conn.execute("COMMIT")


def row_to_option(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": int(row["id"]), "text": row["option_text"], "votes": int(row["votes"])}


def fetch_poll(conn: sqlite3.Connection, poll_id: str) -> dict[str, Any] | None:
    poll = conn.execute(
        "SELECT id, question, created_at, expires_at FROM polls WHERE id = ?",
        (poll_id,),
    ).fetchone()
    if poll is None:
        return None

    expires_at = poll["expires_at"]
    is_expired = False
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            is_expired = datetime.now(timezone.utc) >= exp_dt
        except ValueError:
            pass

    option_rows = conn.execute(
        """
        SELECT id, option_text, votes
        FROM options
        WHERE poll_id = ?
        ORDER BY id ASC
        """,
        (poll_id,),
    ).fetchall()

    return {
        "id": poll["id"],
        "question": poll["question"],
        "created_at": poll["created_at"],
        "expires_at": expires_at,
        "is_expired": is_expired,
        "options": [row_to_option(row) for row in option_rows],
    }


def create_poll(
    poll_id: str,
    question: str,
    options: list[str],
    expires_in_minutes: int | None = None,
) -> dict[str, Any]:
    expires_at_str = None
    if expires_in_minutes and expires_in_minutes > 0:
        exp_dt = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
        expires_at_str = exp_dt.isoformat()

    with get_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "INSERT INTO polls (id, question, expires_at) VALUES (?, ?, ?)",
            (poll_id, question, expires_at_str),
        )
        conn.executemany(
            "INSERT INTO options (poll_id, option_text, votes) VALUES (?, ?, 0)",
            [(poll_id, text) for text in options],
        )
        poll = fetch_poll(conn, poll_id)
        conn.execute("COMMIT")
        if poll is None:
            raise RuntimeError("Failed to load poll after insert")
        return poll


def poll_exists(conn: sqlite3.Connection, poll_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM polls WHERE id = ? LIMIT 1", (poll_id,)).fetchone()
    return row is not None


def increment_vote(poll_id: str, option_id: int) -> dict[str, Any] | None:
    """Atomically increment a vote. Returns None if the poll does not exist."""
    with get_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        poll = fetch_poll(conn, poll_id)
        if poll is None:
            conn.execute("ROLLBACK")
            return None

        if poll.get("is_expired"):
            conn.execute("ROLLBACK")
            return {"error": "poll_expired"}

        cursor = conn.execute(
            """
            UPDATE options
            SET votes = votes + 1
            WHERE id = ? AND poll_id = ?
            """,
            (option_id, poll_id),
        )
        if cursor.rowcount == 0:
            conn.execute("ROLLBACK")
            return {"error": "option_not_found"}

        updated_poll = fetch_poll(conn, poll_id)
        conn.execute("COMMIT")
        return updated_poll


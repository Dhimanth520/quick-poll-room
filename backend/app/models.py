"""Pydantic v2 request and response schemas."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field, field_validator


class CreatePollRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    options: list[str] = Field(..., min_length=2, max_length=5)
    expires_in_minutes: int | None = Field(default=None, ge=1, le=43200)

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Question must not be empty")
        return cleaned

    @field_validator("options")
    @classmethod
    def options_must_be_unique_and_non_empty(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value]
        if any(not item for item in cleaned):
            raise ValueError("Options must not be empty")
        if len(cleaned) < 2 or len(cleaned) > 5:
            raise ValueError("Provide between 2 and 5 options")
        lowered = [item.casefold() for item in cleaned]
        if len(set(lowered)) != len(lowered):
            raise ValueError("Options must be unique")
        return cleaned


class VoteRequest(BaseModel):
    option_id: Annotated[int, Field(gt=0)]


class OptionResponse(BaseModel):
    id: int
    text: str
    votes: int


class PollResponse(BaseModel):
    id: str
    question: str
    options: list[OptionResponse]
    created_at: str | None = None
    expires_at: str | None = None
    is_expired: bool = False


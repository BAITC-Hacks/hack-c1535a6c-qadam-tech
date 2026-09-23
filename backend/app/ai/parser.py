from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .client import parse_text_response
from .prompts import PARSER_SYSTEM_PROMPT


class SearchIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city: str | None = None
    date: str | None = Field(default=None, description="Normalized as YYYY-MM-DD when explicitly present.")
    event_format: str | None = None
    category: str | None = None
    budget_kzt: int | None = Field(default=None, ge=0)
    duration_hours: float | None = Field(default=None, ge=0)
    languages: list[str] = Field(default_factory=list)


def parse_search_query(text: str) -> SearchIntent:
    if not text or not text.strip():
        return SearchIntent()

    return parse_text_response(
        text_format=SearchIntent,
        instructions=PARSER_SYSTEM_PROMPT,
        user_input=text.strip(),
        max_output_tokens=500,
    )

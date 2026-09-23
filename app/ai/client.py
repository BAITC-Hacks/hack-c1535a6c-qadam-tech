from __future__ import annotations

import os
from functools import lru_cache
from typing import TypeVar

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)

ParsedModelT = TypeVar("ParsedModelT", bound=BaseModel)


class MissingOpenAIKeyError(RuntimeError):
    """Raised when an OpenAI-backed function is called without credentials."""


@lru_cache(maxsize=1)
def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise MissingOpenAIKeyError(
            "OPENAI_API_KEY is not set. Add it to the environment or .env before using AI functions."
        )
    return OpenAI(api_key=api_key)


def parse_text_response(
    *,
    text_format: type[ParsedModelT],
    instructions: str,
    user_input: str,
    max_output_tokens: int = 600,
) -> ParsedModelT:
    response = get_openai_client().responses.parse(
        model=OPENAI_MODEL,
        instructions=instructions,
        input=user_input,
        text_format=text_format,
        max_output_tokens=max_output_tokens,
        temperature=0,
        store=False,
    )
    parsed = response.output_parsed
    if parsed is None:
        raise RuntimeError("OpenAI returned no parsed structured output.")
    return parsed

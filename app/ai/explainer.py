from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .client import parse_text_response
from .prompts import EXPLAINER_SYSTEM_PROMPT


class ContractorExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contractor_index: int = Field(..., ge=0, le=2)
    explanation: str = Field(..., min_length=1)


class ContractorExplanationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    explanations: list[ContractorExplanation] = Field(default_factory=list, max_length=3)


def _first_present(data: Mapping[str, Any], keys: Sequence[str]) -> Any:
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return None


def _normalize_text(value: Any) -> str:
    return " ".join(str(value).split()).casefold()


def _as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        return list(value)
    return [value]


def build_evidence(query: Mapping[str, Any] | BaseModel, contractor: Mapping[str, Any] | BaseModel) -> dict[str, Any]:
    query_data = query.model_dump() if isinstance(query, BaseModel) else dict(query)
    contractor_data = contractor.model_dump() if isinstance(contractor, BaseModel) else dict(contractor)

    query_city = query_data.get("city")
    contractor_city = _first_present(contractor_data, ("city", "location_city"))
    query_format = query_data.get("event_format")
    contractor_formats = _first_present(contractor_data, ("event_formats", "formats", "event_format"))
    query_date = query_data.get("date")
    busy_dates = contractor_data.get("busy_dates")
    query_budget = _as_float(query_data.get("budget_kzt"))
    price = _as_float(contractor_data.get("price_from_kzt"))
    query_duration = _as_float(query_data.get("duration_hours"))
    max_hours = _as_float(_first_present(contractor_data, ("max_hours", "duration_hours", "max_duration_hours")))

    contractor_languages = _first_present(contractor_data, ("languages", "language"))
    query_languages = query_data.get("languages") or []
    contractor_language_lookup = {_normalize_text(language) for language in _as_list(contractor_languages)}
    matching_languages = [
        str(language)
        for language in _as_list(query_languages)
        if _normalize_text(language) in contractor_language_lookup
    ]

    budget_margin = None
    if query_budget is not None and price is not None:
        budget_margin = int(query_budget - price)

    duration_margin = None
    if query_duration is not None and max_hours is not None:
        duration_margin = max_hours - query_duration

    return {
        "city_match": None
        if not query_city or not contractor_city
        else _normalize_text(query_city) == _normalize_text(contractor_city),
        "format_match": None
        if not query_format or contractor_formats is None
        else _normalize_text(query_format) in {_normalize_text(item) for item in _as_list(contractor_formats)},
        "available_on_date": None
        if not query_date or busy_dates is None
        else str(query_date) not in {str(item) for item in _as_list(busy_dates)},
        "budget_margin_kzt": budget_margin,
        "duration_margin_hours": duration_margin,
        "matching_languages": matching_languages,
    }


def explain_contractors(
    query: dict[str, Any],
    contractors: list[dict[str, Any]],
    evidence: dict[str, Any] | list[dict[str, Any]] | None = None,
) -> ContractorExplanationResult:
    top_contractors = contractors[:3]

    if evidence is None:
        evidence_payload: dict[str, Any] | list[dict[str, Any]] = [
            build_evidence(query, contractor) for contractor in top_contractors
        ]
    else:
        evidence_payload = evidence[:3] if isinstance(evidence, list) else evidence

    payload = {
        "query": query,
        "contractors": [
            {"contractor_index": index, "contractor": contractor}
            for index, contractor in enumerate(top_contractors)
        ],
        "evidence": evidence_payload,
    }

    return parse_text_response(
        text_format=ContractorExplanationResult,
        instructions=EXPLAINER_SYSTEM_PROMPT,
        user_input=json.dumps(payload, ensure_ascii=False),
        max_output_tokens=700,
    )

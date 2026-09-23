"""Мост между детерминированным поиском и AI-модулем (app/ai).

- enrich_explanations: переписывает объяснения топ-3 через LLM, опираясь на
  evidence (факты из фильтров/скоринга + цитату из описания). Любая ошибка
  или отсутствие ключа -> остаются шаблонные объяснения.
- parse_text: свободный текст -> параметры поиска (LLM, иначе правила).

Результаты кэшируются по запросу, поэтому повторный запрос даёт тот же текст.
"""

import json
import logging
import os
from datetime import date

from . import explain, rules_parser
from .search import FORMAT_STEMS

log = logging.getLogger("llm")
_explain_cache: dict[str, list[str]] = {}
_parse_cache: dict[str, dict] = {}


def enabled() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def _ai_query(req: dict) -> dict:
    """Запрос в формате, который ожидает app/ai (SearchIntent)."""
    return {
        "city": req["city"],
        "date": req["event_date"].isoformat(),
        "event_format": req["event_type"],
        "category": req["category"],
        "budget_kzt": int(req["budget"]),
        "duration_hours": req.get("duration"),
        "languages": [req["language"]] if req.get("language") else [],
    }


def enrich_explanations(req: dict, response: dict, candidates_by_id: dict[str, dict]) -> dict:
    results = response["results"]
    for r in results:
        r["explanation_source"] = "template"
    if not results or not enabled():
        return response

    key = json.dumps({k: str(v) for k, v in req.items()}, sort_keys=True, ensure_ascii=False)
    if key not in _explain_cache:
        try:
            _explain_cache[key] = _call_llm(req, results, candidates_by_id)
        except Exception as exc:  # сеть, таймаут, невалидный ответ — не роняем выдачу
            log.warning("LLM explanations failed, using templates: %s", exc)
            return response

    for r, text in zip(results, _explain_cache[key]):
        if text:
            r["explanation"] = text + (" [синтетический профиль]" if r["is_synthetic"] else "")
            r["explanation_source"] = "llm"
    return response


def _call_llm(req: dict, results: list[dict], candidates_by_id: dict[str, dict]) -> list[str]:
    from .ai import build_evidence, explain_contractors  # импорт тут: openai нужен только при наличии ключа

    query = _ai_query(req)
    stems = FORMAT_STEMS.get(req["event_type"].lower(), [req["event_type"].lower()])
    contractors, evidence = [], []
    for r in results:
        c = candidates_by_id[r["id"]]
        ev = build_evidence(query, c)
        others = [p["price_from_kzt"] for p in results if p["id"] != r["id"]]
        ev.update({
            "rank": r["rank"],
            "description_mentions_event_format": r["score"]["mentions_event_type"],
            "relevant_description_quote": explain.best_quote(c["description"], stems),
            "cheapest_in_selection": bool(others) and all(r["price_from_kzt"] < p for p in others),
            "most_expensive_in_selection": bool(others) and all(r["price_from_kzt"] > p for p in others),
        })
        evidence.append(ev)
        # busy_dates не отправляем: доступность уже в evidence.available_on_date
        contractors.append({k: v for k, v in c.items() if k != "busy_dates"})

    parsed = explain_contractors(query, contractors, evidence)
    texts = [""] * len(results)
    for item in parsed.explanations:
        if 0 <= item.contractor_index < len(results):
            texts[item.contractor_index] = item.explanation.strip()
    return texts


def parse_text(text: str, facets: dict) -> dict:
    """Свободный текст -> {city, event_date, event_type, category, budget, duration, language, source}."""
    text = text.strip()
    if text in _parse_cache:
        return _parse_cache[text]

    result = None
    if enabled():
        try:
            from .ai import parse_search_query

            intent = parse_search_query(text)
            result = {
                "city": _snap(intent.city, facets["cities"]),
                "event_date": intent.date,
                "event_type": _snap(intent.event_format, facets["event_formats"]),
                "category": _snap(intent.category, facets["categories"]),
                "budget": intent.budget_kzt,
                "duration": intent.duration_hours,
                "language": _snap(intent.languages[0], facets["languages"]) if intent.languages else None,
                "source": "llm",
            }
        except Exception as exc:
            log.warning("LLM parse failed, using rules: %s", exc)

    if result is None:
        result = {**rules_parser.parse(text, facets), "source": "rules"}

    # дата вне окна датасета бесполезна
    if result["event_date"]:
        try:
            d = date.fromisoformat(result["event_date"])
            if not (date.fromisoformat(facets["date_min"]) <= d <= date.fromisoformat(facets["date_max"])):
                result["event_date"] = None
        except ValueError:
            result["event_date"] = None

    _parse_cache[text] = result
    return result


def _snap(value: str | None, options: list[str]) -> str | None:
    """Привести ответ LLM к значению из каталога («ведущего» -> «Ведущий»)."""
    if not value:
        return None
    v = value.strip().lower()
    exact = next((o for o in options if o.lower() == v), None)
    if exact:
        return exact
    matches = [o for o in options if o.lower()[:5] in v or v[:5] in o.lower()]
    return max(matches, key=len) if matches else None

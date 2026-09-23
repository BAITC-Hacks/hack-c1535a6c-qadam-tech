from datetime import date

import pytest

from app import llm
from app.ai.explainer import ContractorExplanation, ContractorExplanationResult
from app.data import load_candidates
from app.search import facets, search

CANDIDATES = load_candidates()
BY_ID = {c["id"]: c for c in CANDIDATES}
FACETS = facets(CANDIDATES)


def req(**kw):
    base = {"city": "Алматы", "event_date": date(2026, 10, 15), "event_type": "свадьба",
            "category": "Ведущий", "budget": 1_500_000, "duration": None, "language": None}
    return {**base, **kw}


def test_found_top3_and_deterministic():
    first, second = search(CANDIDATES, req()), search(CANDIDATES, req())
    assert first["outcome"] == "found"
    assert len(first["results"]) == 3
    assert [r["id"] for r in first["results"]] == [r["id"] for r in second["results"]]


def test_busy_contractors_never_returned():
    r = req(event_date=date(2026, 10, 16))
    for card in search(CANDIDATES, r)["results"]:
        assert "2026-10-16" not in BY_ID[card["id"]]["busy_dates"]


def test_two_dates_give_different_results_because_of_busy():
    a = search(CANDIDATES, req(event_date=date(2026, 10, 15)))
    b = search(CANDIDATES, req(event_date=date(2026, 10, 16)))
    assert [r["id"] for r in a["results"]] != [r["id"] for r in b["results"]]
    assert "заняты на 16.10.2026" in b["message"]


def test_explanations_are_distinct():
    texts = [r["explanation"] for r in search(CANDIDATES, req())["results"]]
    assert len(set(texts)) == len(texts)


def test_no_category_in_city():
    res = search(CANDIDATES, req(city="Астана", category="Декоратор"))
    assert res["outcome"] == "no_category_in_city"
    assert "Алматы" in res["message"]


def test_no_match_explains_reasons():
    res = search(CANDIDATES, req(event_date=date(2026, 12, 26), event_type="конференция",
                                 category="Банкетный зал", budget=200_000))
    assert res["outcome"] == "no_match"
    assert res["results"] == []
    assert "выше бюджета" in res["message"]


def test_null_max_hours_does_not_block_duration():
    res = search(CANDIDATES, req(category="Флорист", event_date=date(2026, 11, 14), budget=500_000, duration=12))
    assert res["results"], "флорист (max_hours = null) не должен отсеиваться по длительности"


def test_llm_explanations_replace_templates(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    llm._explain_cache.clear()

    def fake(query, contractors, evidence):
        assert "busy_dates" not in contractors[0]
        assert all("available_on_date" in e for e in evidence)
        return ContractorExplanationResult(explanations=[
            ContractorExplanation(contractor_index=i, explanation=f"LLM {i}") for i in range(len(contractors))
        ])

    monkeypatch.setattr("app.ai.explain_contractors", fake)
    res = llm.enrich_explanations(req(), search(CANDIDATES, req()), BY_ID)
    assert [r["explanation"].split(" [")[0] for r in res["results"]] == ["LLM 0", "LLM 1", "LLM 2"]
    assert all(r["explanation_source"] == "llm" for r in res["results"])


def test_llm_failure_falls_back_to_templates(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    llm._explain_cache.clear()

    def boom(*a, **kw):
        raise TimeoutError("slow")

    monkeypatch.setattr("app.ai.explain_contractors", boom)
    res = llm.enrich_explanations(req(), search(CANDIDATES, req()), BY_ID)
    assert all(r["explanation_source"] == "template" for r in res["results"])
    assert all(r["explanation"].startswith("Цена от") for r in res["results"])


@pytest.mark.parametrize("text,expected", [
    ("Ведущий на свадьбу в Алматы 15 октября до 1.5 млн", {"category": "Ведущий", "budget": 1_500_000,
                                                          "event_date": "2026-10-15", "city": "Алматы"}),
    ("зал на 14 ноября в Астане, корпоратив", {"category": "Банкетный зал", "event_type": "корпоратив"}),
    ("ведущий церемонии на той", {"category": "Ведущий церемонии", "event_type": "той"}),
])
def test_rules_parser(monkeypatch, text, expected):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    llm._parse_cache.clear()
    parsed = llm.parse_text(text, FACETS)
    assert parsed["source"] == "rules"
    for k, v in expected.items():
        assert parsed[k] == v

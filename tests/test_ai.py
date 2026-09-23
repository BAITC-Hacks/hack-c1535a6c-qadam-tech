from app.ai.explainer import ContractorExplanationResult, build_evidence
from app.ai.parser import SearchIntent


QUERY = {
    "city": "Астана",
    "date": "2026-11-14",
    "event_format": "корпоратив",
    "budget_kzt": 350000,
    "duration_hours": 6,
    "languages": ["русский", "казахский"],
}

CONTRACTOR = {
    "id": "17",
    "anon_name": "Profile 17",
    "categories": ["Ведущий"],
    "city": "Астана",
    "price_from_kzt": 280000,
    "event_formats": ["корпоратив", "свадьба"],
    "languages": ["русский", "казахский"],
    "max_hours": 8,
    "busy_dates": ["2026-11-15"],
    "description": "Test profile",
    "synthetic": False,
    "city_imputed": False,
    "price_imputed": False,
}


def test_search_intent_model_accepts_expected_parser_output_a():
    intent = SearchIntent(
        city="Астана",
        date="2026-11-14",
        event_format="корпоратив",
        category="Ведущий",
        budget_kzt=350000,
        duration_hours=6,
        languages=["русский", "казахский"],
    )

    assert intent.budget_kzt == 350000
    assert intent.date == "2026-11-14"
    assert intent.languages == ["русский", "казахский"]


def test_search_intent_model_accepts_expected_parser_output_b():
    intent = SearchIntent(
        city="Алматы",
        date="2026-10-25",
        category="Фотограф",
        budget_kzt=200000,
    )

    assert intent.city == "Алматы"
    assert intent.category == "Фотограф"
    assert intent.budget_kzt == 200000


def test_search_intent_model_accepts_partial_query_c():
    intent = SearchIntent(city="Астана", category="Флорист")

    assert intent.city == "Астана"
    assert intent.category == "Флорист"
    assert intent.date is None
    assert intent.languages == []


def test_build_evidence_available_contractor_real_dataset_schema():
    evidence = build_evidence(QUERY, CONTRACTOR)

    assert evidence == {
        "city_match": True,
        "format_match": True,
        "available_on_date": True,
        "budget_margin_kzt": 70000,
        "duration_margin_hours": 2,
        "matching_languages": ["русский", "казахский"],
    }


def test_build_evidence_busy_contractor_real_dataset_schema():
    contractor = {**CONTRACTOR, "busy_dates": ["2026-11-14"]}

    evidence = build_evidence(QUERY, contractor)

    assert evidence["available_on_date"] is False


def test_build_evidence_over_budget_real_dataset_schema():
    contractor = {**CONTRACTOR, "price_from_kzt": 420000}

    evidence = build_evidence(QUERY, contractor)

    assert evidence["budget_margin_kzt"] == -70000


def test_build_evidence_null_max_hours_does_not_invent_duration_margin():
    contractor = {**CONTRACTOR, "max_hours": None}

    evidence = build_evidence(QUERY, contractor)

    assert evidence["duration_margin_hours"] is None


def test_build_evidence_language_intersection_real_dataset_schema():
    contractor = {**CONTRACTOR, "languages": ["казахский", "английский"]}

    evidence = build_evidence(QUERY, contractor)

    assert evidence["matching_languages"] == ["казахский"]


def test_build_evidence_language_order_is_deterministic():
    contractor = {**CONTRACTOR, "languages": ["казахский", "русский"]}

    first = build_evidence(QUERY, contractor)
    second = build_evidence(QUERY, contractor)

    assert first["matching_languages"] == second["matching_languages"] == ["русский", "казахский"]


def test_explanation_result_preserves_top_three_indexes_contract():
    result = ContractorExplanationResult(
        explanations=[
            {"contractor_index": 0, "explanation": "Цена оставляет запас бюджета."},
            {"contractor_index": 1, "explanation": "Город совпадает с запросом."},
            {"contractor_index": 2, "explanation": "Дата есть в доступности."},
        ]
    )

    assert [item.contractor_index for item in result.explanations] == [0, 1, 2]

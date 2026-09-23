"""Разбор свободного текста правилами — работает без LLM (fallback для /api/parse)."""

import re

from .search import FORMAT_STEMS

MONTHS = {"сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12}
CITY_STEMS = {"алмат": "Алматы", "астан": "Астана", "зарубеж": "Зарубежье"}
LANG_STEMS = {"русск": "русский", "казах": "казахский", "англ": "английский"}
# категории, которые по первым буквам не находятся
CATEGORY_EXTRA = {"зал": "Банкетный зал", "банкет": "Банкетный зал", "фотобудк": "Фото и видеобудки",
                  "сувенир": "Подарки и сувениры", "подар": "Подарки и сувениры", "цвет": "Флорист",
                  "музыкант": "Инструменталист", "группа": "Лайв-бэнд", "танц": "Танцевальный коллектив",
                  "шоу": "Шоу-программа", "ансамбл": "Национальный ансамбль", "загород": "Загородная площадка"}


def _category(low: str, categories: list[str]) -> str | None:
    # сначала самые длинные названия: «Ведущий церемонии» раньше, чем «Ведущий»
    for cat in sorted(categories, key=len, reverse=True):
        words = cat.lower().split()
        if all(w[:5] in low for w in words):
            return cat
    return next((cat for stem, cat in CATEGORY_EXTRA.items() if stem in low and cat in categories), None)


def parse(text: str, facets: dict) -> dict:
    low = text.lower()

    city = next((c for stem, c in CITY_STEMS.items() if stem in low), None)
    event_type = next((f for f, stems in FORMAT_STEMS.items() if any(s in low for s in stems if len(s) > 3)), None)
    if event_type is None and re.search(r"\bто[йяю]\b", low):
        event_type = "той"
    language = next((l for stem, l in LANG_STEMS.items() if stem in low), None)

    event_date = None
    if m := re.search(r"2026-\d{2}-\d{2}", low):
        event_date = m.group(0)
    elif m := re.search(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")", low):
        event_date = f"2026-{MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}"
    elif m := re.search(r"\b(\d{1,2})\.(\d{1,2})(?:\.2026)?\b", low):
        event_date = f"2026-{int(m.group(2)):02d}-{int(m.group(1)):02d}"

    budget = None
    if m := re.search(r"(?:до|бюджет\w*\s*:?|за|в пределах)\s*(\d[\d\s]*(?:[.,]\d+)?)\s*(млн|тыс|к\b|k\b|₸|тенге|тг)?", low):
        num = float(m.group(1).replace(" ", "").replace(",", "."))
        mult = {"млн": 1_000_000, "тыс": 1000, "к": 1000, "k": 1000}.get((m.group(2) or "").strip(), 1)
        budget = int(num * mult)

    duration = None
    if m := re.search(r"(\d+(?:[.,]\d)?)\s*(?:час|ч\b)", low):
        duration = float(m.group(1).replace(",", "."))

    return {
        "city": city,
        "event_date": event_date,
        "event_type": event_type,
        "category": _category(low, facets["categories"]),
        "budget": budget,
        "duration": duration,
        "language": language,
    }

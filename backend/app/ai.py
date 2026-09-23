"""Объяснения «почему этот подрядчик здесь».

Сейчас это детерминированный шаблон на фактах (без LLM), поэтому backend работает
сам по себе. 2-й участник (AI) может заменить тело explain_match на вызов LLM:
передать ей те же факты + description и попросить 1–2 предложения,
temperature=0, без общих фраз. Сигнатуру не меняйте.
"""

import re

SPLIT = re.compile(r"(?<=[.!?])\s+|\s*[•\n]\s*")
# слова, по которым в описании видно конкретику (опыт, масштаб, стиль)
SIGNAL = re.compile(
    r"\d+\s*(лет|год|свад|меропр|гост|человек|заказ|чел)|опыт|актёр|актер|сценар|импровиз|"
    r"вместим|зал|кухн|меню|команд|стиль|авторск|живой|оборуд|телевед",
    re.IGNORECASE,
)
MAX_QUOTE = 170


def fmt_kzt(value: float) -> str:
    return f"{int(value):,}".replace(",", " ")


def _clip(text: str, anchor: int = 0) -> str:
    """Обрезать до MAX_QUOTE символов по границе слова, стараясь захватить anchor."""
    if len(text) <= MAX_QUOTE:
        return text
    start = max(0, anchor - 40)
    start = text.rfind(" ", 0, start) + 1 if start else 0
    chunk = text[start:start + MAX_QUOTE]
    chunk = chunk[: chunk.rfind(" ")] if " " in chunk else chunk
    return ("…" if start else "") + chunk + "…"


def best_quote(description: str, stems: list[str]) -> str | None:
    """Самый содержательный фрагмент описания: сперва с упоминанием формата, иначе с конкретикой."""
    sentences = [s.strip() for s in SPLIT.split(description) if len(s.strip()) >= 25]
    for s in sentences:
        low = s.lower()
        hit = next((low.find(st) for st in stems if st in low), -1)
        if hit >= 0:
            return _clip(s, hit)
    ranked = sorted(sentences, key=lambda s: -len(SIGNAL.findall(s)))  # sorted стабилен -> детерминизм
    if ranked and SIGNAL.search(ranked[0]):
        return _clip(ranked[0])
    return None


def explain_match(req: dict, c: dict, score: dict, peers: list[dict]) -> str:
    from .search import FORMAT_STEMS  # локальный импорт, чтобы избежать цикла

    # 1. Бюджет — конкретные цифры и сравнение с соседями по выдаче
    diff = req["budget"] - c["price"]
    first = f"Цена от {fmt_kzt(c['price'])} ₸"
    first += f" — на {fmt_kzt(diff)} ₸ ниже бюджета" if diff > 0 else " — ровно в бюджет"
    if peers and all(c["price"] < p["price"] for p in peers):
        first += ", самый доступный в подборке"
    elif peers and all(c["price"] > p["price"] for p in peers):
        first += ", самый дорогой в подборке"
    if c["price_imputed"]:
        first += " (цена ориентировочная)"

    # 2. Дата, язык, длительность — то, чем карточки отличаются друг от друга
    facts = [f"свободен {req['event_date'].strftime('%d.%m')}"]
    langs = ", ".join(c["languages"])
    if req.get("language"):
        facts.append(f"ведёт на языке «{req['language']}» (языки: {langs})")
    elif len(c["languages"]) > 1:
        facts.append(f"языки: {langs}")
    if c["max_hours"] is None:
        facts.append("работа не привязана к часам на площадке")
    elif req.get("duration"):
        facts.append(f"до {int(c['max_hours'])} ч на площадке при запрошенных {req['duration']:g} ч")
    else:
        facts.append(f"до {int(c['max_hours'])} ч на площадке")
    text = f"{first}; {', '.join(facts)}."

    # 3. Смысл описания — уникальная деталь подрядчика
    stems = FORMAT_STEMS.get(req["event_type"].lower(), [req["event_type"].lower()])
    quote = best_quote(c["description"], stems)
    if quote:
        lead = f"Опыт в формате «{req['event_type']}»" if score["mentions_event_type"] else "Из описания"
        text += f" {lead}: «{quote.rstrip('.')}»."

    if c["synthetic"]:
        text += " [синтетический профиль]"
    return text

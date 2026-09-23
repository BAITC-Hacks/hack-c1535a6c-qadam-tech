"""Подбор подрядчиков: жёсткие фильтры -> детерминированное ранжирование -> объяснения.

Пайплайн:
  1. Пул = подрядчики нужной категории в нужном городе.
     Пусто -> outcome "no_category_in_city".
  2. Жёсткие фильтры (занят на дату, бюджет, формат, язык, длительность).
     Для каждого отсеянного запоминаем причины.
     Никто не прошёл -> outcome "no_match" + разбивка причин.
  3. Прошедшие ранжируются по score (детерминированно, tie-break по id).
     Топ-3 -> outcome "found"; если меньше 3 — поясняем, почему.
"""

from collections import Counter
from datetime import date

from . import explain

# стемы для поиска упоминаний формата мероприятия в описании
FORMAT_STEMS = {
    "свадьба": ["свадьб", "свадеб", "wedding"],
    "той": ["той", "тоев", "тоя", "узату", "кыз узату"],
    "корпоратив": ["корпоратив", "корпорат"],
    "конференция": ["конференц", "форум", "бизнес"],
    "юбилей": ["юбиле"],
    "день рождения": ["день рожд", "дней рожд", "дня рожд", "детск"],
}

REASON_TEXT = {
    "busy": "заняты на {date}",
    "budget": "цена выше бюджета {budget} ₸",
    "format": "не берут формат «{event_type}»",
    "language": "не работают на языке «{language}»",
    "duration": "не работают {duration} ч (меньше максимум часов)",
}


def fmt_kzt(value: float) -> str:
    return f"{int(value):,}".replace(",", " ")


def _lower(values: list[str]) -> list[str]:
    return [v.lower() for v in values]


def rejection_reasons(c: dict, req: dict) -> list[str]:
    reasons = []
    if req["event_date"].isoformat() in c["busy_dates"]:
        reasons.append("busy")
    if c["price"] > req["budget"]:
        reasons.append("budget")
    if req["event_type"].lower() not in _lower(c["event_formats"]):
        reasons.append("format")
    if req.get("language") and req["language"].lower() not in _lower(c["languages"]):
        reasons.append("language")
    # max_hours = None -> работа не привязана к присутствию, длительность не ограничивает
    if req.get("duration") and c["max_hours"] is not None and c["max_hours"] < req["duration"]:
        reasons.append("duration")
    return reasons


def description_mentions(c: dict, event_type: str) -> bool:
    text = c["description"].lower()
    return any(stem in text for stem in FORMAT_STEMS.get(event_type.lower(), [event_type.lower()]))


def score(c: dict, req: dict) -> dict:
    """Компоненты скоринга — возвращаем целиком, чтобы объяснение опиралось на них."""
    headroom = 1 - c["price"] / req["budget"]           # 0..1, запас бюджета
    mentions = description_mentions(c, req["event_type"])
    reliability = 3 - int(c["synthetic"]) - int(c["price_imputed"]) - int(c["city_imputed"])
    lang_bonus = 1 if req.get("language") and req["language"].lower() in _lower(c["languages"]) else 0
    hours_margin = 0.0
    if req.get("duration") and c["max_hours"]:
        hours_margin = min((c["max_hours"] - req["duration"]) / req["duration"], 1.0)
    total = (
        3.0 * mentions          # в описании есть опыт именно этого формата
        + 1.0 * reliability / 3  # реальный профиль с точными данными надёжнее
        + 1.5 * headroom        # укладывается в бюджет с запасом
        + 0.5 * lang_bonus
        + 0.5 * hours_margin
    )
    return {
        "total": round(total, 4),
        "mentions_event_type": mentions,
        "budget_headroom": round(headroom, 3),
        "reliability": reliability,
        "hours_margin": round(hours_margin, 3),
    }


def _reason_phrase(key: str, count: int, req: dict) -> str:
    text = REASON_TEXT[key].format(
        date=req["event_date"].strftime("%d.%m.%Y"),
        budget=fmt_kzt(req["budget"]),
        event_type=req["event_type"],
        language=req.get("language"),
        duration=req.get("duration"),
    )
    return f"{count} — {text}"


def search(candidates: list[dict], req: dict, limit: int = 3) -> dict:
    city, category = req["city"].lower(), req["category"].lower()

    pool = [c for c in candidates if c["city"].lower() == city and category in _lower(c["categories"])]

    if not pool:
        elsewhere = sorted({c["city"] for c in candidates if category in _lower(c["categories"])})
        msg = f"В городе {req['city']} нет подрядчиков категории «{req['category']}»."
        if elsewhere:
            msg += f" Эта категория есть в: {', '.join(elsewhere)}."
        return {"outcome": "no_category_in_city", "message": msg, "results": [], "excluded": [], "pool_size": 0}

    passed, excluded = [], []
    for c in pool:
        reasons = rejection_reasons(c, req)
        if reasons:
            excluded.append({"id": c["id"], "name": c["name"], "reasons": reasons})
        else:
            passed.append(c)

    reason_counts = Counter(r for e in excluded for r in e["reasons"])
    reasons_summary = [_reason_phrase(k, n, req) for k, n in reason_counts.most_common()]
    excluded.sort(key=lambda e: e["id"])

    if not passed:
        return {
            "outcome": "no_match",
            "message": (
                f"В {req['city']} есть {len(pool)} подрядчик(ов) категории «{req['category']}», "
                f"но ни один не подходит: " + "; ".join(reasons_summary) + "."
            ),
            "results": [],
            "excluded": excluded,
            "pool_size": len(pool),
        }

    scored = sorted(((score(c, req), c) for c in passed), key=lambda sc: (-sc[0]["total"], sc[1]["id"]))
    top = scored[:limit]
    peers = [c for _, c in top]

    results = []
    for rank, (s, c) in enumerate(top, start=1):
        results.append({
            "rank": rank,
            "id": c["id"],
            "name": c["name"],
            "categories": c["categories"],
            "city": c["city"],
            "price_from_kzt": c["price"],
            "languages": c["languages"],
            "event_formats": c["event_formats"],
            "max_hours": c["max_hours"],
            "description": c["description"],
            "busy_dates": c["busy_dates"],
            "is_synthetic": c["synthetic"],
            "price_imputed": c["price_imputed"],
            "city_imputed": c["city_imputed"],
            "score": s,
            "explanation": explain.explain_match(req, c, s, [p for p in peers if p["id"] != c["id"]]),
        })

    message = f"Подобрано {len(results)} из {len(pool)} подрядчиков категории «{req['category']}» в {req['city']}."
    if len(results) < limit:
        if reasons_summary:
            message += f" Меньше {limit}, потому что остальные отсеяны: " + "; ".join(reasons_summary) + "."
        else:
            message += f" Меньше {limit}, потому что в каталоге всего {len(pool)} такой подрядчик(ов)."
    elif len(passed) > limit:
        message += f" Подходят {len(passed)}, показаны лучшие {limit}."

    return {"outcome": "found", "message": message, "results": results, "excluded": excluded, "pool_size": len(pool)}


def facets(candidates: list[dict]) -> dict:
    """Возможные значения полей — для выпадающих списков на фронтенде."""
    def uniq(key: str) -> list[str]:
        vals = set()
        for c in candidates:
            v = c[key]
            vals.update(v if isinstance(v, list) else [v])
        return sorted(vals)

    return {
        "cities": uniq("city"),
        "categories": uniq("categories"),
        "event_formats": uniq("event_formats"),
        "languages": uniq("languages"),
        "date_min": "2026-09-23",
        "date_max": "2026-12-31",
    }

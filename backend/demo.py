"""Демо-сценарии из Definition of Done. Запуск: python demo.py [base_url]"""

import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765"

SCENARIOS = [
    ("Плотная категория, осень", {"city": "Алматы", "event_date": "2026-10-15", "event_type": "свадьба",
                                  "category": "Ведущий", "budget": 1500000}),
    ("Тот же запрос, другая дата", {"city": "Алматы", "event_date": "2026-10-16", "event_type": "свадьба",
                                    "category": "Ведущий", "budget": 1500000}),
    ("Редкая категория", {"city": "Алматы", "event_date": "2026-11-14", "event_type": "свадьба",
                          "category": "Флорист", "budget": 500000}),
    ("Мало кандидатов в каталоге", {"city": "Астана", "event_date": "2026-11-14", "event_type": "свадьба",
                                    "category": "Флорист", "budget": 500000}),
    ("Нет категории в городе", {"city": "Астана", "event_date": "2026-11-14", "event_type": "свадьба",
                                "category": "Декоратор", "budget": 500000}),
    ("Кандидаты есть, никто не проходит", {"city": "Алматы", "event_date": "2026-12-26",
                                           "event_type": "конференция", "category": "Банкетный зал",
                                           "budget": 200000}),
]


def post(payload: dict) -> dict:
    req = urllib.request.Request(f"{BASE}/api/search", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


for title, payload in SCENARIOS:
    d = post(payload)
    print(f"=== {title}: {payload}")
    print(f"[{d['outcome']}] {d['message']}")
    for r in d["results"]:
        print(f"  #{r['rank']} {r['name']} ({r['id']}), {r['price_from_kzt']} ₸, score={r['score']['total']}")
        print(f"     {r['explanation']}")
    busy = [e["name"] for e in d["excluded"] if "busy" in e["reasons"]]
    if busy:
        print(f"  заняты на дату: {', '.join(busy)}")
    print()

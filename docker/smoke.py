"""Verify the complete frontend -> proxy -> backend path; no third-party packages."""
import json
import sys
from urllib.request import Request, urlopen


def check(base: str) -> None:
    def get(path: str) -> bytes:
        with urlopen(base + path, timeout=30) as response:
            return response.read()

    def post(path: str, data: dict) -> dict:
        request = Request(base + path, data=json.dumps(data).encode(),
                          headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=60) as response:
            return json.load(response)

    assert b'id="root"' in get("/"), "Frontend HTML missing"
    assert get("/healthz").strip() == b"ok", "Nginx is not ready"
    health = json.loads(get("/api/health"))
    assert health["status"] == "ok" and health["candidates"] == 66, health
    assert "Алматы" in json.loads(get("/api/facets"))["cities"]
    assert get("/images/entertainment.jpg").startswith(b"\xff\xd8"), "Card photo missing"
    request = dict(city="Алматы", event_date="2026-10-15", event_type="свадьба",
                   category="Ведущий", budget=1500000)
    result = post("/api/search", request)
    assert result["outcome"] == "found" and len(result["results"]) == 3, result
    for card in result["results"]:
        assert card["price_from_kzt"] <= request["budget"]
        assert request["event_date"] not in card["busy_dates"]
        assert card["explanation"].strip()
    no_category = post("/api/search", {**request, "city": "Астана", "category": "Декоратор"})
    assert no_category["outcome"] == "no_category_in_city" and not no_category["results"]
    no_match = post("/api/search", {**request, "budget": 1})
    assert no_match["outcome"] == "no_match" and not no_match["results"]
    parsed = post("/api/parse", {"text": "Нужен ведущий на свадьбу в Алматы 15 октября 2026 года, бюджет до 1 500 000 тенге."})
    for field, value in request.items():
        assert parsed[field] == value, (field, parsed[field], value)
    print("PASS: frontend, images, proxy, health, facets, search outcomes and text parsing")
    print("Parse source:", parsed["source"])
    print("Explanation sources:", [card["explanation_source"] for card in result["results"]])


if __name__ == "__main__":
    check((sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080").rstrip("/"))

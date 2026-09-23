# Backend — умный подбор подрядчиков (FastAPI)

## Запуск

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8765 --reload
```

Swagger: http://localhost:8765/docs · демо-сценарии: `.venv/bin/python demo.py`

## Пайплайн

1. **Данные** (`app/data.py`): `data/dataset.csv` → pandas → списки (`|`) → `data/candidates.json` (кэш).
2. **Пул** (`app/search.py`): подрядчики нужной категории в нужном городе. Пусто → `no_category_in_city`.
3. **Жёсткие фильтры**: занят на дату (`busy_dates`), `price_from_kzt > budget`, формат, язык, `max_hours < duration`
   (`max_hours = null` не ограничивает). Для каждого отсеянного сохраняются причины. Никто не прошёл → `no_match`.
4. **Ранжирование** (детерминированное, tie-break по `id`):
   `3·(описание упоминает этот формат) + 1·надёжность профиля + 1.5·запас бюджета + 0.5·язык + 0.5·запас по часам`.
5. **Объяснение** (`app/ai.py`): факты (цена vs бюджет и соседи по выдаче, свободная дата, языки, часы)
   + цитата из описания, релевантная формату. Синтетические профили помечены.

## API

`GET /api/facets`: списки городов, категорий, форматов, языков и окно дат (для dropdown'ов).

`POST /api/search`

```json
{"city": "Алматы", "event_date": "2026-10-15", "event_type": "свадьба",
 "category": "Ведущий", "budget": 1500000, "duration": 5, "language": "казахский"}
```

`duration` и `language` необязательны. Ответ:

```json
{
  "outcome": "found | no_category_in_city | no_match",
  "message": "человекочитаемое пояснение, почему столько результатов",
  "pool_size": 10,
  "results": [{"rank": 1, "id": "HK-35215", "name": "Кики", "categories": ["Ведущий"], "city": "Алматы",
               "price_from_kzt": 900000, "languages": [], "event_formats": [], "max_hours": 10,
               "is_synthetic": false, "price_imputed": false, "city_imputed": false,
               "score": {"total": 4.6}, "explanation": "Цена от 900 000 ₸ — на 600 000 ₸ ниже бюджета; …"}],
  "excluded": [{"id": "HK-…", "name": "…", "reasons": ["busy", "budget", "format", "language", "duration"]}]
}
```

## Для AI-участника

`app/ai.py → explain_match(req, candidate, score, peers)` сейчас работает на шаблоне, без LLM.
Замените тело на вызов LLM (temperature=0, в промпт передать факты + `description` + `peers`,
чтобы объяснения не были взаимозаменяемы). Сигнатуру и тип возвращаемого значения (`str`) не меняйте.
Если LLM недоступна, оставьте текущий шаблон как fallback.

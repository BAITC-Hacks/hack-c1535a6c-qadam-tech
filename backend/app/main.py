import logging
from datetime import date

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from . import llm  # noqa: E402  (после load_dotenv, чтобы увидеть OPENAI_API_KEY)
from .data import load_candidates  # noqa: E402
from .search import facets, search  # noqa: E402

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="ToiTap — умный подбор подрядчиков")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

CANDIDATES = load_candidates()
BY_ID = {c["id"]: c for c in CANDIDATES}
FACETS = facets(CANDIDATES)


class SearchRequest(BaseModel):
    city: str = Field(examples=["Алматы"])
    event_date: date = Field(examples=["2026-10-15"])
    event_type: str = Field(examples=["свадьба"])
    category: str = Field(examples=["Ведущий"])
    budget: float = Field(gt=0, examples=[800000])
    duration: float | None = Field(default=None, gt=0, examples=[5])
    language: str | None = Field(default=None, examples=["казахский"])


class ParseRequest(BaseModel):
    text: str = Field(min_length=1, examples=["Ведущий на свадьбу в Алматы 15 октября до 1.5 млн, на казахском"])


@app.get("/api/health")
def health():
    return {"status": "ok", "candidates": len(CANDIDATES), "llm": llm.enabled()}


@app.get("/api/facets")
def get_facets():
    return FACETS


@app.post("/api/parse")
def post_parse(req: ParseRequest):
    return llm.parse_text(req.text, FACETS)


@app.post("/api/search")
def post_search(req: SearchRequest):
    if not (date.fromisoformat(FACETS["date_min"]) <= req.event_date <= date.fromisoformat(FACETS["date_max"])):
        raise HTTPException(422, f"Дата должна быть в окне {FACETS['date_min']} — {FACETS['date_max']}")
    params = req.model_dump()
    return llm.enrich_explanations(params, search(CANDIDATES, params), BY_ID)

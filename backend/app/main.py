from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .data import load_candidates
from .search import facets, search

app = FastAPI(title="Qadam Tech — умный подбор подрядчиков")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

CANDIDATES = load_candidates()
FACETS = facets(CANDIDATES)


class SearchRequest(BaseModel):
    city: str = Field(examples=["Алматы"])
    event_date: date = Field(examples=["2026-10-15"])
    event_type: str = Field(examples=["свадьба"])
    category: str = Field(examples=["Ведущий"])
    budget: float = Field(gt=0, examples=[800000])
    duration: float | None = Field(default=None, gt=0, examples=[5])
    language: str | None = Field(default=None, examples=["казахский"])


@app.get("/api/health")
def health():
    return {"status": "ok", "candidates": len(CANDIDATES)}


@app.get("/api/facets")
def get_facets():
    return FACETS


@app.post("/api/search")
def post_search(req: SearchRequest):
    if not (date.fromisoformat(FACETS["date_min"]) <= req.event_date <= date.fromisoformat(FACETS["date_max"])):
        raise HTTPException(422, f"Дата должна быть в окне {FACETS['date_min']} — {FACETS['date_max']}")
    return search(CANDIDATES, req.model_dump())

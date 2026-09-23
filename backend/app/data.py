"""Data layer: CSV (pandas) -> JSON cache -> in-memory list of candidates."""

import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CSV_PATH = DATA_DIR / "dataset.csv"
JSON_PATH = DATA_DIR / "candidates.json"

LIST_COLUMNS = ["categories", "event_formats", "languages", "busy_dates"]


def csv_to_records(path: Path = CSV_PATH) -> list[dict]:
    df = pd.read_csv(path)
    for col in LIST_COLUMNS:
        df[col] = df[col].fillna("").astype(str).apply(lambda s: [x.strip() for x in s.split("|") if x.strip()])
    df = df.rename(columns={"anon_name": "name", "price_from_kzt": "price"})
    df["max_hours"] = df["max_hours"].astype(object).where(df["max_hours"].notna(), None)
    return df.to_dict(orient="records")


def load_candidates() -> list[dict]:
    """CSV bor bo'lsa undan o'qiydi va JSON'ga saqlaydi, aks holda JSON'dan."""
    if CSV_PATH.exists():
        records = csv_to_records()
        JSON_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2))
        return records
    return json.loads(JSON_PATH.read_text())

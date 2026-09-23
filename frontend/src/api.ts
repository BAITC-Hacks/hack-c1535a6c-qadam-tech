// Контракт backend (backend/README.md) и чистые помощники для UI.

export interface SearchParams {
  city: string;
  event_date: string;
  event_type: string;
  category: string;
  budget: number;
  duration: number | null;
  language: string | null;
}

export type Outcome = 'found' | 'no_category_in_city' | 'no_match';
export type Reason = 'busy' | 'budget' | 'format' | 'language' | 'duration';

export interface Card {
  rank: number;
  id: string;
  name: string;
  categories: string[];
  city: string;
  price_from_kzt: number;
  languages: string[];
  event_formats: string[];
  max_hours: number | null;
  description: string;
  busy_dates: string[];
  is_synthetic: boolean;
  price_imputed: boolean;
  city_imputed: boolean;
  explanation: string;
  explanation_source: 'llm' | 'template';
}

export interface SearchResponse {
  outcome: Outcome;
  message: string;
  pool_size: number;
  results: Card[];
  excluded: { id: string; name: string; reasons: Reason[] }[];
}

export interface Facets {
  cities: string[];
  categories: string[];
  event_formats: string[];
  languages: string[];
  date_min: string;
  date_max: string;
}

export type Parsed = Partial<Record<keyof SearchParams, string | number | null>> & { source: 'llm' | 'rules' };

const BASE: string = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? '';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(typeof detail?.detail === 'string' ? detail.detail : `Ошибка сервера (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const fetchFacets = () => request<Facets>('/api/facets');
export const searchContractors = (p: SearchParams) => request<SearchResponse>('/api/search', p);
export const parseText = (text: string) => request<Parsed>('/api/parse', { text });

/** Подставить в текущие параметры только то, что распознано в тексте. */
export function mergeParsed(current: SearchParams, parsed: Parsed): SearchParams {
  const next = { ...current };
  (Object.keys(current) as (keyof SearchParams)[]).forEach(key => {
    const value = parsed[key];
    if (value !== null && value !== undefined && value !== '') (next as Record<string, unknown>)[key] = value;
  });
  return next;
}

export function validate(p: SearchParams, f: Pick<Facets, 'date_min' | 'date_max'>): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.event_date) || p.event_date < f.date_min || p.event_date > f.date_max)
    return `Укажите дату с ${formatDate(f.date_min)} по ${formatDate(f.date_max)}.`;
  if (!(p.budget > 0)) return 'Бюджет должен быть больше нуля.';
  if (p.duration !== null && !(p.duration > 0 && p.duration <= 24)) return 'Длительность — от 1 до 24 часов.';
  return null;
}

export const REASON_LABEL: Record<Reason, string> = {
  busy: 'занят на эту дату',
  budget: 'выше бюджета',
  format: 'не берёт этот формат',
  language: 'нет нужного языка',
  duration: 'не работает столько часов',
};

export const money = (n: number) => Math.round(n).toLocaleString('ru-RU');
export const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

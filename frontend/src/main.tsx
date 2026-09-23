import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Sparkles, MapPin, SlidersHorizontal, X, Moon, Sun, Check, Heart, Camera, Video, Mic2, Music, Flower2, ShieldCheck, ChevronDown, LoaderCircle, Search, Bookmark, Building2, Gift, Users, FlaskConical, type LucideIcon } from 'lucide-react';
import { fetchFacets, formatDate, mergeParsed, money, parseText, REASON_LABEL, searchContractors, validate, type Card, type Facets, type SearchParams, type SearchResponse } from './api';
import { DatePicker } from './DatePicker';
import './style.css';

const initial: SearchParams = { city: 'Алматы', event_date: '2026-10-15', event_type: 'свадьба', category: 'Ведущий', budget: 1500000, duration: null, language: null };

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Фотограф': Camera, 'Видеограф': Video, 'Фото и видеобудки': Camera, 'Ведущий': Mic2, 'Ведущий церемонии': Mic2,
  'Лайв-бэнд': Music, 'Инструменталист': Music, 'Национальный ансамбль': Music, 'Танцевальный коллектив': Users,
  'Шоу-программа': Sparkles, 'Флорист': Flower2, 'Декоратор': Flower2, 'Подарки и сувениры': Gift,
  'Банкетный зал': Building2, 'Ресторан': Building2, 'Загородная площадка': Building2, 'Отель': Building2,
};

const OUTCOME_TITLE: Record<SearchResponse['outcome'], string> = {
  found: 'Кажется, вы сработаетесь',
  no_category_in_city: 'В этом городе нет такой категории',
  no_match: 'Кандидаты есть, но никто не проходит по условиям',
};

const clip = (text: string, n = 170) => (text.length > n ? `${text.slice(0, text.lastIndexOf(' ', n))}…` : text);

function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
  }, [value]);
  return <textarea ref={ref} rows={3} aria-label="Опишите ваше событие" value={value} onChange={e => onChange(e.target.value)}
    placeholder="Например: ведущий на свадьбу в Алматы 15 октября, до 1,5 млн ₸, на казахском, 5 часов." />;
}

function App() {
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('toitap-theme') === 'dark'; } catch { return false; } });
  const [facets, setFacets] = useState<Facets | null>(null);
  const [query, setQuery] = useState('');
  const [params, setParams] = useState(initial);
  const [searched, setSearched] = useState(initial);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [parsedFrom, setParsedFrom] = useState<'llm' | 'rules' | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(false);
  const [saved, setSaved] = useState<Card[]>(() => { try { return JSON.parse(localStorage.getItem('toitap-saved-v2') || '[]'); } catch { return []; } });
  const [savedView, setSavedView] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);
  const [about, setAbout] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFacets()
      .then(f => { setFacets(f); return runSearch(initial, f); })
      .catch(() => setError('Backend недоступен. Запустите его: cd backend && .venv/bin/uvicorn app.main:app --port 8765'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected && !about) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSelected(null); setAbout(false); } };
    document.addEventListener('keydown', handler);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [selected, about]);

  const toggleSave = (card: Card) => setSaved(prev => {
    const next = prev.some(c => c.id === card.id) ? prev.filter(c => c.id !== card.id) : [...prev, card];
    try { localStorage.setItem('toitap-saved-v2', JSON.stringify(next)); } catch { /* приватный режим */ }
    return next;
  });

  async function runSearch(next: SearchParams, f: Facets | null = facets) {
    if (!f) return;
    const problem = validate(next, f);
    if (problem) { setError(problem); return; }
    setError(''); setLoading(true); setSavedView(false); setParams(next);
    try {
      setResponse(await searchContractors(next));
      setSearched(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить подбор.');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    let next = params;
    setParsedFrom(null);
    if (query.trim()) {
      try {
        const parsed = await parseText(query);
        next = mergeParsed(params, parsed);
        setParsedFrom(parsed.source);
      } catch { /* текст не разобран — ищем по текущим фильтрам */ }
    }
    await runSearch(next);
  }

  const change = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => setParams(p => ({ ...p, [key]: value }));
  const shown: Card[] = savedView ? saved : response?.results ?? [];
  const isSaved = (id: string) => saved.some(c => c.id === id);
  const busyExcluded = response?.excluded.filter(e => e.reasons.includes('busy')) ?? [];

  return <div className={dark ? 'app dark' : 'app'}>
    <header>
      <a className="logo" href="#" aria-label="ToiTap, главная" onClick={() => setSavedView(false)}><span className="logo-mark">t<span>✦</span></span>toi<span className="logo-light">tap</span><span className="logo-dot">.</span></a>
      <nav>
        <button className={!savedView ? 'nav-active' : ''} onClick={() => { setSavedView(false); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }); }}>Найти подрядчика</button>
        <button onClick={() => setAbout(true)}>Как это работает <ArrowUpRight size={13} /></button>
      </nav>
      <div className="header-actions">
        <button className="saved-nav" onClick={() => setSavedView(!savedView)}><Bookmark size={17} /> <span>Избранное</span>{saved.length > 0 && <b>{saved.length}</b>}</button>
        <span className="divider" />
        <button className="icon-button" aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'} onClick={() => setDark(prev => { try { localStorage.setItem('toitap-theme', !prev ? 'dark' : 'light'); } catch { /* ignore */ } return !prev; })}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> МЕНЬШЕ ПОИСКА. БОЛЬШЕ СОВПАДЕНИЙ.</div>
          <h1>Ваше событие.<br />Ваши люди<span className="emerald">.</span><span className="hero-spark">✳</span></h1>
          <p>Расскажите о планах — мы выберем до трёх подрядчиков<br className="desktop" /> и объясним, почему именно они.</p>
          <div className="hero-proof"><div className="mini-avatars"><span>А</span><span>Д</span><span>М</span></div><span><strong>66 подрядчиков</strong><br />Алматы и Астана · 17 категорий</span></div>
        </div>
        <div className="hero-visual">
          <img src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1100&q=90" alt="Молодожёны в тёплом вечернем свете" />
          <span className="photo-label"><span /> МОМЕНТЫ НАЧИНАЮТСЯ С ЛЮДЕЙ</span>
          <div className="floating-note"><span className="note-icon"><Sparkles size={20} /></span><div>Не просто список.<br /><strong>Объяснение к каждому.</strong></div><span className="note-check"><Check size={16} /></span></div>
          <div className="visual-caption">Для событий, которые остаются с нами.</div>
        </div>
      </section>

      <section className="search-panel" aria-label="Поиск подрядчиков">
        <div className="search-title"><span><Sparkles size={18} /> Начнём с вашей идеи</span><span className="ai-badge">УМНЫЙ ПОДБОР</span></div>
        <form onSubmit={e => { e.preventDefault(); void submit(); }}>
          <div className="query-row">
            <SearchInput value={query} onChange={setQuery} />
            <button className="primary search-button" disabled={loading || !facets} type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} {loading ? 'Подбираем...' : 'Найти своих людей'}<ArrowRight size={18} /></button>
          </div>
          <div className="search-bottom">
            <div className="quick-filters">
              <label><MapPin size={15} /><select className="brand-select" aria-label="Город" value={params.city} onChange={e => change('city', e.target.value)}>{facets?.cities.map(c => <option key={c}>{c}</option>)}</select></label>
              {facets && <DatePicker value={params.event_date} min={facets.date_min} max={facets.date_max} onChange={v => change('event_date', v)} />}
              <label><select className="brand-select" aria-label="Формат" value={params.event_type} onChange={e => change('event_type', e.target.value)}>{facets?.event_formats.map(x => <option key={x}>{x}</option>)}</select></label>
              <button type="button" aria-expanded={filters} aria-controls="search-filters" className={filters ? 'filter-button active' : 'filter-button'} onClick={() => setFilters(!filters)}><SlidersHorizontal size={15} /> Параметры <ChevronDown size={13} /></button>
            </div>
            <span className="search-hint">Одна идея → до 3 точных рекомендаций</span>
          </div>
          {filters && <div id="search-filters" className="expanded-filters">
            <label>Бюджет, ₸<input inputMode="numeric" value={params.budget ? money(params.budget) : ''} onChange={e => change('budget', Number(e.target.value.replace(/\D/g, '')))} /></label>
            <label>Язык<select className="brand-select" value={params.language ?? ''} onChange={e => change('language', e.target.value || null)}><option value="">Любой</option>{facets?.languages.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Длительность, ч<input type="number" min="1" max="24" placeholder="не важно" value={params.duration ?? ''} onChange={e => change('duration', e.target.value ? Number(e.target.value) : null)} /></label>
          </div>}
        </form>
        {parsedFrom && <p className="constraint-note">Параметры распознаны из текста ({parsedFrom === 'llm' ? 'AI' : 'правила'}) и подставлены в фильтры.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="categories">
          {facets?.categories.map(category => {
            const Icon = CATEGORY_ICONS[category] ?? Sparkles;
            return <button key={category} className={params.category === category ? 'category selected' : 'category'} onClick={() => { setQuery(''); void runSearch({ ...params, category }); }}><Icon size={16} />{category}</button>;
          })}
        </div>
      </section>

      <section id="results" className="results">
        <div className="results-header">
          <div>
            <div className="section-eyebrow">{savedView ? 'ВАШ ЛИЧНЫЙ СПИСОК' : 'ПОДОБРАНО С ОБЪЯСНЕНИЕМ'}</div>
            <h2>{savedView ? 'Избранные подрядчики' : response ? OUTCOME_TITLE[response.outcome] : 'Подбираем…'} <span>{shown.length}</span></h2>
            <p>{savedView ? 'Сохранённые профили. Доступность на дату проверяйте новым поиском.' : `${searched.category} · ${searched.city} · ${formatDate(searched.event_date)} · ${searched.event_type} · до ${money(searched.budget)} ₸${searched.duration ? ` · ${searched.duration} ч` : ''}${searched.language ? ` · ${searched.language}` : ''}`}</p>
          </div>
          <div className="availability"><span /><span>Только свободные на вашу дату</span></div>
        </div>

        {!savedView && response && response.results.length > 0 && <p className="constraint-note" role="status">{response.message}</p>}

        <div aria-live="polite" aria-busy={loading} className={loading ? 'cards loading' : 'cards'}>
          {shown.map((c, i) => {
            const Icon = CATEGORY_ICONS[c.categories[0]] ?? Sparkles;
            return <article className="contractor-card" key={c.id}>
              <div className="card-photo placeholder">
                <Icon size={46} strokeWidth={1.2} />
                {i === 0 && !savedView && <span className="best-badge"><Sparkles size={13} /> Лучшее совпадение</span>}
                <button className={'heart ' + (isSaved(c.id) ? 'is-saved' : '')} aria-label={isSaved(c.id) ? `Убрать ${c.name} из избранного` : `Сохранить ${c.name}`} aria-pressed={isSaved(c.id)} onClick={() => toggleSave(c)}><Heart size={18} fill={isSaved(c.id) ? 'currentColor' : 'none'} /></button>
                <span className="photo-count">{c.categories.join(', ')} · {c.city}</span>
              </div>
              <div className="card-content">
                <div className="card-heading">
                  <h3>{c.name}</h3>
                  <span className={c.is_synthetic ? 'profile-kind synthetic' : 'profile-kind'}>{c.is_synthetic ? <><FlaskConical size={12} /> синтетический</> : <><Check size={12} /> реальный</>}</span>
                </div>
                <p className="description">{clip(c.description)}</p>
                <div className="tags">{c.event_formats.map(t => <span key={t}>{t}</span>)}{c.languages.map(t => <span key={t}>{t}</span>)}</div>
                <div className="match-reason">
                  <span><Sparkles size={14} />{savedView ? 'Почему был в подборке' : 'Почему он здесь'}{c.explanation_source === 'llm' && <em className="source-badge">AI</em>}</span>
                  <p>{c.explanation}</p>
                </div>
                <div className="card-footer">
                  <div><strong>от {money(c.price_from_kzt)} <span>₸</span></strong><small>{c.price_imputed ? 'цена ориентировочная' : 'за мероприятие'}{c.max_hours ? ` · до ${c.max_hours} ч` : ''}</small></div>
                  <button className="profile-button" onClick={() => setSelected(c)}>Профиль <ArrowUpRight size={16} /></button>
                </div>
              </div>
            </article>;
          })}
        </div>

        {!loading && shown.length === 0 && <div className="empty">
          <Search size={30} />
          <h3>{savedView ? 'Ваши люди ещё впереди' : response ? OUTCOME_TITLE[response.outcome] : 'Загрузка…'}</h3>
          <p>{savedView ? 'Нажмите на сердечко в карточке, чтобы сохранить подрядчика.' : response?.message}</p>
        </div>}

        {!savedView && response && response.excluded.length > 0 && <details className="excluded">
          <summary>Не попали в выдачу: {response.excluded.length}{busyExcluded.length ? ` (заняты ${formatDate(searched.event_date)} — ${busyExcluded.length})` : ''}</summary>
          <ul>{response.excluded.map(e => <li key={e.id}><strong>{e.name}</strong> — {e.reasons.map(r => REASON_LABEL[r]).join(', ')}</li>)}</ul>
        </details>}

        <div className="results-note"><ShieldCheck size={16} /><span>Занятые на дату, дороже бюджета и не берущие ваш формат в выдачу не попадают.</span></div>
      </section>

      <section className="how-strip">
        <div><span className="step-number">01</span><div><h4>Расскажите о событии</h4><p>Текстом или фильтрами.</p></div></div><ArrowRight size={20} />
        <div><span className="step-number">02</span><div><h4>Получите до трёх</h4><p>Только свободные и подходящие.</p></div></div><ArrowRight size={20} />
        <div><span className="step-number">03</span><div><h4>Поймите почему</h4><p>Объяснение на фактах к каждой карточке.</p></div></div>
      </section>
    </main>

    <footer><span className="footer-brand">toitap.</span><span>Хорошие события начинаются с людей.</span><span>66 профилей датасета · 13 синтетических помечены</span><span>© 2026 ToiTap</span></footer>

    {(selected || about) && <div className="modal-overlay" onClick={() => { setSelected(null); setAbout(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={selected?.name || 'Как работает подбор'} onClick={e => e.stopPropagation()}>
        <button autoFocus className="modal-close icon-button" aria-label="Закрыть" onClick={() => { setSelected(null); setAbout(false); }}><X /></button>
        {selected ? <div className="modal-body">
          <div className="eyebrow">{selected.is_synthetic ? 'СИНТЕТИЧЕСКИЙ ПРОФИЛЬ' : 'ПРОФИЛЬ ИЗ ДАТАСЕТА'} · {selected.id}</div>
          <h2>{selected.name}</h2>
          <p>{selected.categories.join(', ')} · {selected.city}{selected.city_imputed ? ' (город восстановлен)' : ''}</p>
          <p>{selected.description}</p>
          <p><strong>Языки:</strong> {selected.languages.join(', ')}</p>
          <p><strong>Форматы:</strong> {selected.event_formats.join(', ')}</p>
          <p><strong>Цена:</strong> от {money(selected.price_from_kzt)} ₸{selected.price_imputed ? ' (ориентировочно)' : ''}{selected.max_hours ? ` · до ${selected.max_hours} ч на площадке` : ' · не привязан к часам'}</p>
          <p><strong>Занято дней до 31.12:</strong> {selected.busy_dates.length} из 100</p>
          <button className="primary" onClick={() => toggleSave(selected)}><Heart size={16} />{isSaved(selected.id) ? 'Убрать из избранного' : 'Сохранить подрядчика'}</button>
        </div> : <div className="modal-body">
          <Sparkles className="emerald" />
          <h2>Как работает подбор</h2>
          <p><strong>1. Запрос.</strong> Текст разбирается в параметры (AI через OpenAI или правила, если ключа нет) и подставляется в фильтры.</p>
          <p><strong>2. Пул.</strong> Подрядчики нужной категории в городе. Пусто — сообщаем, что категории в городе нет.</p>
          <p><strong>3. Фильтры.</strong> Убираем занятых на дату, дороже бюджета, не берущих формат, без нужного языка или часов. Для каждого запоминаем причину.</p>
          <p><strong>4. Ранжирование.</strong> Опыт этого формата в описании, запас бюджета, надёжность профиля. Порядок детерминирован.</p>
          <p><strong>5. Объяснение.</strong> AI пишет 1–2 предложения только по фактам; без ключа — шаблон на тех же фактах.</p>
        </div>}
      </section>
    </div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

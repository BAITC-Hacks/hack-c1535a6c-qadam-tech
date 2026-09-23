import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Sparkles, MapPin, CalendarDays, SlidersHorizontal, X, Moon, Sun, Check, Heart, Camera, Video, Mic2, Disc3, Flower2, Star, ShieldCheck, ChevronDown, LoaderCircle, Search, Bookmark } from 'lucide-react';
import { categories, contractors, matchContractors, parseQuery, type SearchParams, type SearchResponse, type Contractor } from './data';
import './style.css';
const initial: SearchParams = { city: 'Алматы', date: '2026-10-03', category: 'Фотограф', budget: 250000, language: 'Русский', format: 'Свадьба', hours: 6 };
const icons = [Camera, Video, Mic2, Disc3, Flower2];
const money = (n: number) => n.toLocaleString('ru-RU');
interface SearchInputProps {
 value: string;
 onChange: (value: string) => void;
}
function SearchInput({ value, onChange }: SearchInputProps) {
 const ref = useRef<HTMLTextAreaElement>(null);
 useLayoutEffect(() => {
  const input = ref.current;
  if (!input) return;
  const resize = () => {
   input.style.height = 'auto';
   input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
  };
  resize();
  let previousWidth = input.getBoundingClientRect().width;
  const observer = new ResizeObserver(() => {
   const width = input.getBoundingClientRect().width;
   if (width !== previousWidth) { previousWidth = width; resize(); }
  });
  observer.observe(input);
  return () => observer.disconnect();
 }, [value]);
 return <textarea ref={ref} rows={3} aria-label="Опишите ваше событие" value={value} onChange={event => onChange(event.target.value)} placeholder="Например: фотограф на свадьбу в Алматы 3 октября, до 250 000 ₸. Любим живые, естественные кадры." />;
}
function App() {
 const [dark, setDark] = useState(() => localStorage.getItem('toitap-theme') === 'dark');
 const [query, setQuery] = useState('');
 const [params, setParams] = useState(initial);
 const [response, setResponse] = useState<SearchResponse>(() => matchContractors(initial));
 const [loading, setLoading] = useState(false);
 const [filters, setFilters] = useState(false);
 const [saved, setSaved] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem('toitap-saved') || '[]'); } catch { return []; } });
 const [savedView, setSavedView] = useState(false);
 const [selected, setSelected] = useState<Contractor | null>(null);
 const [about, setAbout] = useState(false);
 const [error, setError] = useState('');
 const [searched, setSearched] = useState(initial);
 useEffect(() => {
  if (!selected && !about) return;
  const previous = document.activeElement as HTMLElement | null;
  const handler = (event: KeyboardEvent) => {
   if (event.key === 'Escape') { setSelected(null); setAbout(false); }
   if (event.key === 'Tab') {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.modal button, .modal a, .modal input'));
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
   }
  };
  document.addEventListener('keydown', handler);
  const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = oldOverflow; previous?.focus(); };
 }, [selected, about]);
 const toggleSave = (id: number) => setSaved(prev => { const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; localStorage.setItem('toitap-saved', JSON.stringify(next)); return next; });
 const search = async (override?: SearchParams) => {
  const next = override || parseQuery(query, params);
  const validDate = !Number.isNaN(Date.parse(next.date)) && new Date(next.date).toISOString().slice(0,10) === next.date;
  if (!validDate || next.date < '2026-09-23' || next.date > '2026-12-31' || next.budget <= 0 || next.hours < 1 || next.hours > 24) { setError('Укажите действительную дату с 23 сентября по 31 декабря 2026, положительный бюджет и длительность от 1 до 24 часов.'); return; }
  setError(''); setLoading(true); setSavedView(false); setParams(next);
  try { await new Promise(resolve => setTimeout(resolve, 450)); setResponse(matchContractors(next)); setSearched(next); } catch { setError('Не удалось выполнить подбор. Попробуйте ещё раз.'); } finally { setLoading(false); }
 };
 const shown = savedView ? contractors.filter(c => saved.includes(c.id)).map(c => ({ contractor: c, price: c.price, explanation: c.description })) : response.matches;
 const change = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => setParams(p => ({ ...p, [key]: value }));
 return <div className={dark ? 'app dark' : 'app'}>
  <header><a className="logo" href="#" aria-label="ToiTap, главная" onClick={() => setSavedView(false)}><span className="logo-mark">t<span>✦</span></span>toi<span className="logo-light">tap</span><span className="logo-dot">.</span></a><nav><button className={!savedView ? 'nav-active' : ''} onClick={() => { setSavedView(false); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }); }}>Найти специалиста</button><button onClick={() => setAbout(true)}>Как это работает <ArrowUpRight size={13}/></button></nav><div className="header-actions"><button className="saved-nav" onClick={() => setSavedView(!savedView)}><Bookmark size={17}/> <span>Избранное</span>{saved.length > 0 && <b>{saved.length}</b>}</button><span className="divider"/><button className="icon-button" aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'} onClick={() => setDark(prev => { localStorage.setItem('toitap-theme', !prev ? 'dark' : 'light'); return !prev; })}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button><span className="avatar">A</span></div></header>
  <main><section className="hero"><div className="hero-copy"><div className="eyebrow"><span/> МЕНЬШЕ ПОИСКА. БОЛЬШЕ СОВПАДЕНИЙ.</div><h1>Ваше событие.<br/>Ваши люди<span className="emerald">.</span><span className="hero-spark">✳</span></h1><p>Расскажите о планах — мы найдём тех, кто поймёт<br className="desktop"/> вашу идею. И объясним, почему вы подходите друг другу.</p><div className="hero-proof"><div className="mini-avatars"><span>А</span><span>Д</span><span>М</span></div><span><strong>66 специалистов</strong><br/>в одном тщательно собранном каталоге</span></div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1100&q=90" alt="Молодожёны в тёплом вечернем свете"/><span className="photo-label"><span/> МОМЕНТЫ НАЧИНАЮТСЯ С ЛЮДЕЙ</span><div className="floating-note"><span className="note-icon"><Sparkles size={20}/></span><div>Не просто список.<br/><strong>Ваше идеальное совпадение.</strong></div><span className="note-check"><Check size={16}/></span></div><div className="visual-caption">Для событий, которые остаются с нами.</div></div></section>
  <section className="search-panel" aria-label="Поиск специалистов"><div className="search-title"><span><Sparkles size={18}/> Начнём с вашей идеи</span><span className="ai-badge">УМНЫЙ ПОДБОР</span></div><form onSubmit={e => { e.preventDefault(); void search(); }}><div className="query-row"><SearchInput value={query} onChange={setQuery}/><button className="primary search-button" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} {loading ? 'Подбираем...' : 'Найти своих людей'}<ArrowRight size={18}/></button></div><div className="search-bottom"><div className="quick-filters"><label><MapPin size={15}/><select aria-label="Город" value={params.city} onChange={e => change('city', e.target.value)}>{['Алматы', 'Астана', 'Шымкент'].map(c => <option key={c}>{c}</option>)}</select></label><label><CalendarDays size={15}/><input aria-label="Дата события" type="date" min="2026-09-23" max="2026-12-31" value={params.date} onChange={e => change('date', e.target.value)}/></label><button type="button" aria-expanded={filters} aria-controls="search-filters" className={filters ? 'filter-button active' : 'filter-button'} onClick={() => setFilters(!filters)}><SlidersHorizontal size={15}/> Параметры <ChevronDown size={13}/></button></div><span className="search-hint">Одна идея → до 3 точных рекомендаций</span></div>{filters && <div id="search-filters" className="expanded-filters"><label>Бюджет, ₸<input type="number" min="1" value={params.budget} onChange={e => change('budget', Number(e.target.value))}/></label><label>Формат<select value={params.format} onChange={e => change('format', e.target.value)}>{['Свадьба','Корпоратив','День рождения'].map(x => <option key={x}>{x}</option>)}</select></label><label>Язык<select value={params.language} onChange={e => change('language', e.target.value)}>{['Любой','Русский','Казахский'].map(x => <option key={x}>{x}</option>)}</select></label><label>Длительность, ч<input type="number" min="1" max="24" value={params.hours} onChange={e => change('hours', Number(e.target.value))}/></label></div>}</form>{error && <p role="alert" className="error">{error}</p>}<div className="categories">{categories.map((category, i) => { const Icon = icons[i]; return <button key={category} className={params.category === category ? 'category selected' : 'category'} onClick={() => { const next = { ...params, category }; setParams(next); setQuery(''); void search(next); }}><Icon size={16}/>{['Фотографы','Видеографы','Ведущие','Диджеи','Декораторы'][i]}</button>; })}<span className="category-caption">Большой день начинается с правильных людей</span></div></section>
  <section id="results" className="results"><div className="results-header"><div><div className="section-eyebrow">{savedView ? 'ВАШ ЛИЧНЫЙ СПИСОК' : 'ПОДОБРАНО С ВНИМАНИЕМ К ДЕТАЛЯМ'}</div><h2>{savedView ? 'Избранные специалисты' : 'Кажется, вы сработаетесь'} <span>{shown.length}</span></h2><p>{savedView ? 'Сохранённые профили. Дату и итоговую стоимость проверяйте новым поиском.' : `${searched.category} · ${searched.city} · ${new Date(searched.date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · до ${money(searched.budget)} ₸ · ${searched.hours} ч`}</p></div><div className="availability"><span/><span>Только свободные на вашу дату</span></div></div><div aria-live="polite" aria-busy={loading} className={loading ? 'cards loading' : 'cards'}>{shown.map(({ contractor: c, price, explanation }, i) => <article className="contractor-card" key={c.id}><div className="card-photo"><img src={c.image} alt={`Пример визуального стиля ${c.name}`} loading="lazy"/>{i === 0 && !savedView && <span className="best-badge"><Sparkles size={13}/> Отличное совпадение</span>}<button className={'heart ' + (saved.includes(c.id) ? 'is-saved' : '')} aria-label={saved.includes(c.id) ? `Убрать ${c.name} из избранного` : `Сохранить ${c.name}`} aria-pressed={saved.includes(c.id)} onClick={() => toggleSave(c.id)}><Heart size={18} fill={saved.includes(c.id) ? 'currentColor' : 'none'}/></button><span className="photo-count">{c.category} · {c.city}</span></div><div className="card-content"><div className="card-heading"><h3>{c.name}</h3><span className="rating"><Star size={13} fill="currentColor"/> {c.rating.toFixed(1)} <small>({c.reviews})</small></span></div><p className="description">{c.description}</p><div className="tags">{c.tags.map(t => <span key={t}>{t}</span>)}</div><div className="match-reason"><span><Sparkles size={14}/>{savedView ? 'О специалисте' : 'Почему вам подходит'}</span><p>{explanation}</p></div><div className="card-footer"><div><strong>{money(price)} <span>₸</span></strong><small>{savedView ? 'базовая стоимость / 6 часов' : `за ${searched.hours} часов · всё учтено`}</small></div><button className="profile-button" onClick={() => setSelected(c)}>Профиль <ArrowUpRight size={16}/></button></div></div></article>)}</div>{!loading && shown.length === 0 && <div className="empty"><Search size={30}/><h3>{savedView ? 'Ваши люди ещё впереди' : response.status === 'category_missing' ? 'В этом городе пока нет такой категории' : 'На эти условия совпадений нет'}</h3><p>{savedView ? 'Нажмите на сердечко в карточке, чтобы сохранить специалиста.' : 'Попробуйте другую дату, увеличьте бюджет или измените параметры.'}</p></div>}{!savedView && response.matches.length < 3 && <p className="constraint-note" role="status">Найдено {response.matches.length} из 3 рекомендаций. {response.status === 'category_missing' ? 'В демонстрационном каталоге нет этой категории в выбранном городе.' : `Исключено: заняты — ${response.excluded.booked}, выше бюджета — ${response.excluded.budget}, другой язык — ${response.excluded.language}, другой формат — ${response.excluded.format}.`}</p>}<div className="results-note"><ShieldCheck size={16}/><span>Учитываем бюджет, формат, язык и занятость. Чтобы каждое совпадение имело смысл.</span></div></section>
  <section className="how-strip"><div><span className="step-number">01</span><div><h4>Расскажите о событии</h4><p>Своими словами. Без длинных анкет.</p></div></div><ArrowRight size={20}/><div><span className="step-number">02</span><div><h4>Получите точный подбор</h4><p>До трёх специалистов и причины выбора.</p></div></div><ArrowRight size={20}/><div><span className="step-number">03</span><div><h4>Найдите своего человека</h4><p>Изучите профили и сохраните любимые.</p></div></div></section>
  </main><footer><span className="footer-brand">toitap.</span><span>Хорошие события начинаются с людей.</span><span>Демо · 66 синтетических профилей · подбор без AI API</span><span>© 2026 ToiTap</span></footer>
  {(selected || about) && <div className="modal-overlay" onClick={() => { setSelected(null); setAbout(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label={selected?.name || 'Как работает подбор'} onClick={e => e.stopPropagation()}><button autoFocus className="modal-close icon-button" aria-label="Закрыть" onClick={() => { setSelected(null); setAbout(false); }}><X/></button>{selected ? <><img className="modal-photo" src={selected.image} alt="Иллюстрация портфолио"/><div className="modal-body"><div className="eyebrow">ДЕМОНСТРАЦИОННЫЙ ПРОФИЛЬ</div><h2>{selected.name}</h2><p>{selected.category} · {selected.city} · ★ {selected.rating}</p><p>{selected.description}</p><p><strong>Языки:</strong> {selected.languages.join(', ')}</p><p><strong>События:</strong> {selected.formats.join(', ')}</p><p><strong>Базовая стоимость:</strong> {money(selected.price)} ₸ / 6 ч. В декабре +30%, дополнительные часы пропорционально.</p><p><strong>Занятые даты:</strong> {[...new Set(selected.bookedDates)].sort().map(d => new Date(d + 'T12:00:00').toLocaleDateString('ru-RU')).join(', ')}</p><button className="primary" onClick={() => toggleSave(selected.id)}><Heart size={16}/>{saved.includes(selected.id) ? 'Убрать из избранного' : 'Сохранить специалиста'}</button></div></> : <div className="modal-body"><Sparkles className="emerald"/><h2>Хороший подбор — с объяснением</h2><p>Опишите категорию, город, дату и бюджет. Например: «Фотограф на свадьбу в Алматы 3 октября до 250 тыс, на русском, 6 часов».</p><p>Распознанные значения появятся в параметрах поиска. Неуказанные значения сохраняются из текущих параметров. Предпочтения по стилю пока не распознаются.</p><p>Сначала исключаем занятых и неподходящих по бюджету, языку и формату. Затем показываем до трёх профилей с лучшим рейтингом.</p><p>Это демо: 66 синтетических анкет, иллюстративные фото, локальный разбор текста и объяснения на основе данных. Для production требуется реальный каталог и AI API. Доступный период: 23.09–31.12.2026.</p></div>}</section></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

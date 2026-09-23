export type Category = 'Фотограф' | 'Видеограф' | 'Ведущий' | 'DJ' | 'Декоратор';
export interface Contractor { id: number; name: string; category: Category; city: string; price: number; rating: number; reviews: number; languages: string[]; formats: string[]; bookedDates: string[]; description: string; image: string; tags: string[]; }
export interface SearchParams { city: string; date: string; category: Category; budget: number; language: string; format: string; hours: number; }
export interface Match { contractor: Contractor; price: number; explanation: string; }
export interface SearchResponse { status: 'success' | 'category_missing' | 'constraints_failed'; matches: Match[]; total: number; excluded: { booked: number; budget: number; language: number; format: number }; }
export const categories: Category[] = ['Фотограф', 'Видеограф', 'Ведущий', 'DJ', 'Декоратор'];
export const photos = [
 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85',
 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=85',
 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=85',
];
const specialty: Record<Category, { description: string; tags: string[] }> = {
 'Фотограф': { description: 'Естественные кадры и внимание к деталям вашего дня.', tags: ['Живые эмоции', 'Репортаж'] },
 'Видеограф': { description: 'Фильм о вашем событии с живым звуком и вниманием к истории.', tags: ['Короткий фильм', 'Живой звук'] },
 'Ведущий': { description: 'Продуманная программа, тактичный юмор и внимание к каждому гостю.', tags: ['Интерактивная программа', 'Тактичный юмор'] },
 'DJ': { description: 'Музыка под настроение гостей: от встречи до последнего танца.', tags: ['Индивидуальный плейлист', 'Танцевальная программа'] },
 'Декоратор': { description: 'Цельное оформление пространства: флористика, текстиль и детали.', tags: ['Авторская флористика', 'Оформление пространства'] },
};
const names = ['Alem Studio', 'Sәule Photo', 'Dara Stories', 'Asyl Films', 'Nomad Creative', 'Jaryq Studio', 'Satti Events', 'Arman Project', 'Mira Moments', 'Aura Collective', 'Forma Studio'];
export const contractors: Contractor[] = Array.from({ length: 66 }, (_, i) => {
 const category = i < 3 ? 'Фотограф' : categories[(i - 3) % 5];
 return { id: i + 1, name: i < 3 ? names[i] : `${names[i % names.length]} ${String(i + 1).padStart(2, '0')}`, category, city: i < 3 ? 'Алматы' : category === 'Видеограф' && i % 3 === 2 ? 'Астана' : ['Алматы', 'Астана', 'Шымкент'][i % 3], price: i < 3 ? [180000, 150000, 200000][i] : 70000 + (i % 9) * 25000, rating: i < 3 ? [4.9, 4.8, 5.0][i] : Number((4.6 + (i % 5) / 10).toFixed(1)), reviews: 18 + ((i * 17 + 46) % 93), languages: i % 4 === 3 ? ['Казахский'] : ['Русский', 'Казахский'], formats: i % 7 === 6 ? ['Корпоратив', 'День рождения'] : ['Свадьба', 'Корпоратив', 'День рождения'], bookedDates: ['2026-12-25', `2026-10-${String(10 + i % 20).padStart(2, '0')}`, `2026-12-${String(15 + i % 16).padStart(2, '0')}`], description: category !== 'Фотограф' ? specialty[category].description : ['Живые эмоции, естественный свет и кадры, в которых хочется остаться.', 'Бережно сохраняем детали и настоящие чувства вашего дня.', 'Кинематографичный взгляд на вашу историю. Ничего случайного.'][i % 3], image: photos[i % 3], tags: category !== 'Фотограф' ? specialty[category].tags : [['Живые эмоции', 'Репортаж'], ['Естественный свет', 'Нежная обработка'], ['Редакционный стиль', 'Детали']][i % 3] };
});
export function matchContractors(params: SearchParams): SearchResponse {
 const pool = contractors.filter(c => c.city === params.city && c.category === params.category);
 const excluded = { booked: 0, budget: 0, language: 0, format: 0 };
 const matches: Match[] = [];
 for (const c of pool) {
  const price = Math.round(c.price * (params.date.startsWith('2026-12') ? 1.3 : 1) * Math.max(1, params.hours / 6));
  if (c.bookedDates.includes(params.date)) { excluded.booked++; continue; }
  if (price > params.budget) { excluded.budget++; continue; }
  if (params.language !== 'Любой' && !c.languages.includes(params.language)) { excluded.language++; continue; }
  if (!c.formats.includes(params.format)) { excluded.format++; continue; }
  const remaining = params.budget - price;
  matches.push({ contractor: c, price, explanation: `${c.tags[0]} и ${c.tags[1].toLowerCase()} подойдут для события «${params.format.toLowerCase()}». ${params.language === 'Любой' ? 'Работает на ' + c.languages.map(l => l === 'Русский' ? 'русском' : 'казахском').join(' и ') : 'Работает на ' + (params.language === 'Русский' ? 'русском' : 'казахском')} языке; ${remaining ? `остаётся ${remaining.toLocaleString('ru-RU')} ₸ от бюджета` : 'стоимость точно укладывается в бюджет'} за ${params.hours} ч.${params.date.startsWith('2026-12') ? ' Декабрьская наценка включена.' : ''}` });
 }
 matches.sort((a, b) => b.contractor.rating - a.contractor.rating || a.price - b.price);
 return { status: !pool.length ? 'category_missing' : matches.length ? 'success' : 'constraints_failed', matches: matches.slice(0, 3), total: matches.length, excluded };
}
export function parseQuery(query: string, current: SearchParams): SearchParams {
 const q = query.toLowerCase();
 const result = { ...current };
 for (const [stem, city] of [['алматы', 'Алматы'], ['астан', 'Астана'], ['шымкент', 'Шымкент']]) if (q.includes(stem)) result.city = city;
 const category = [['фотограф', 'Фотограф'], ['видеограф', 'Видеограф'], ['ведущ', 'Ведущий'], ['дидже', 'DJ'], ['dj', 'DJ'], ['декорат', 'Декоратор']].find(([key]) => q.includes(key));
 if (category) result.category = category[1] as Category;
 const budget = q.match(/(?:до|бюджет\s*:?|за)\s*(\d[\d ]*)\s*(тыс|к|₸|тенге)/);
 if (budget) result.budget = Number(budget[1].replaceAll(' ', '')) * (/тыс|к/.test(budget[2]) ? 1000 : 1);
 const iso = q.match(/2026-\d{2}-\d{2}/);
 const date = q.match(/(\d{1,2})\s+(сентябр|октябр|ноябр|декабр)/);
 if (iso) result.date = iso[0];
 else if (date) result.date = `2026-${({ сентябр: '09', октябр: '10', ноябр: '11', декабр: '12' } as Record<string,string>)[date[2]]}-${date[1].padStart(2,'0')}`;
 if (q.includes('русск')) result.language = 'Русский';
 if (q.includes('казах')) result.language = 'Казахский';
 if (q.includes('свадьб')) result.format = 'Свадьба';
 if (q.includes('корпоратив')) result.format = 'Корпоратив';
 if (q.includes('день рождения')) result.format = 'День рождения';
 const hours = q.match(/(\d+)\s*(?:час|ч\b)/); if (hours) result.hours = Number(hours[1]);
 return result;
}

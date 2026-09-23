import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeParsed, validate, type SearchParams } from './api.ts';

const base: SearchParams = { city: 'Алматы', event_date: '2026-10-15', event_type: 'свадьба', category: 'Ведущий', budget: 1500000, duration: null, language: null };
const window = { date_min: '2026-09-23', date_max: '2026-12-31' };

test('mergeParsed overrides only recognised fields', () => {
  const next = mergeParsed(base, { source: 'rules', city: 'Астана', category: null, budget: 300000 });
  assert.equal(next.city, 'Астана');
  assert.equal(next.category, 'Ведущий');
  assert.equal(next.budget, 300000);
});

test('validate accepts a correct request', () => assert.equal(validate(base, window), null));

test('validate rejects date outside dataset window', () => {
  assert.match(validate({ ...base, event_date: '2027-01-05' }, window) ?? '', /дату/);
});

test('validate rejects non-positive budget and bad duration', () => {
  assert.ok(validate({ ...base, budget: 0 }, window));
  assert.ok(validate({ ...base, duration: 30 }, window));
});

import { describe, it, expect } from 'vitest';
import {
  parseViews,
  serializeViews,
  makeView,
  findMatchingView,
  migrateFilters,
} from './transactionViews';

describe('parseViews', () => {
  it('returns [] for null/undefined', () => {
    expect(parseViews(null)).toEqual([]);
    expect(parseViews(undefined)).toEqual([]);
  });

  it('returns [] for invalid JSON', () => {
    expect(parseViews('not json')).toEqual([]);
  });

  it('returns [] for non-array JSON', () => {
    expect(parseViews('{"x":1}')).toEqual([]);
    expect(parseViews('"hi"')).toEqual([]);
    expect(parseViews('42')).toEqual([]);
  });

  it('parses a JSON array string', () => {
    const views = [{ id: 'v_1', name: 'a', filters: {} }];
    expect(parseViews(JSON.stringify(views))).toEqual(views);
  });

  it('passes through array values (re-mapped after migration)', () => {
    const views = [{ id: 'v_1', name: 'a', filters: {} }];
    expect(parseViews(views)).toEqual(views);
  });
});

describe('serializeViews', () => {
  it('round-trips through parseViews when filters are already in plural form', () => {
    const views = [
      { id: 'v_1', name: 'Food', filters: { types: ['expense'], categoryIds: [3, 1] } },
      { id: 'v_2', name: 'Salary', filters: { types: ['income'] } },
    ];
    expect(parseViews(serializeViews(views))).toEqual(views);
  });

  it('serializes nullish to "[]"', () => {
    expect(serializeViews(null)).toBe('[]');
    expect(serializeViews(undefined)).toBe('[]');
  });
});

describe('makeView', () => {
  it('returns an object with id, name, filters, createdAt', () => {
    const v = makeView('  My View  ', { type: 'expense', categoryIds: [1, 2] });
    expect(v.id).toMatch(/^v_\d+_[a-z0-9]+$/);
    expect(v.name).toBe('My View');
    expect(v.filters).toEqual({ type: 'expense', categoryIds: [1, 2] });
    expect(typeof v.createdAt).toBe('string');
    expect(() => new Date(v.createdAt).toISOString()).not.toThrow();
  });

  it('snapshots filters (no shared reference)', () => {
    const filters = { type: 'expense', categoryIds: [1] };
    const v = makeView('x', filters);
    filters.type = 'income';
    expect(v.filters.type).toBe('expense');
  });
});

describe('migrateFilters', () => {
  it('converts legacy single-value keys into plural arrays', () => {
    const out = migrateFilters({
      type: 'expense',
      accountId: 5,
      owner: 'alice',
      platform: 'Swiggy',
      tag: 'food',
      beneficiary: 'self',
    });
    expect(out).toEqual({
      types: ['expense'],
      accountIds: [5],
      owners: ['alice'],
      platforms: ['Swiggy'],
      tags: ['food'],
      beneficiaries: ['self'],
    });
  });

  it('treats empty string / null as empty array', () => {
    const out = migrateFilters({ type: '', accountId: null, owner: undefined });
    expect(out.types).toEqual([]);
    expect(out.accountIds).toEqual([]);
    expect(out.owners).toEqual([]);
    expect('type' in out).toBe(false);
  });

  it('preserves existing plural keys and ignores legacy if both present', () => {
    const out = migrateFilters({ type: 'expense', types: ['income'] });
    expect(out.types).toEqual(['income']);
    expect('type' in out).toBe(false);
  });

  it('passes other fields through untouched', () => {
    const out = migrateFilters({ dateFrom: '2026-01-01', search: 'hi', categoryIds: [1, 2] });
    expect(out).toEqual({ dateFrom: '2026-01-01', search: 'hi', categoryIds: [1, 2] });
  });
});

describe('parseViews migration', () => {
  it('migrates legacy filters in saved views on read', () => {
    const legacy = JSON.stringify([
      { id: 'v_1', name: 'Old', filters: { type: 'expense', owner: 'alice' } },
    ]);
    const out = parseViews(legacy);
    expect(out[0].filters).toEqual({ types: ['expense'], owners: ['alice'] });
  });
});

describe('findMatchingView', () => {
  const views = [
    { id: 'a', name: 'A', filters: { type: 'expense', categoryIds: [1, 2, 3] } },
    { id: 'b', name: 'B', filters: { type: 'income' } },
  ];

  it('matches equivalent filters regardless of array order', () => {
    expect(findMatchingView({ type: 'expense', categoryIds: [3, 1, 2] }, views)?.id).toBe('a');
  });

  it('treats empty values as equivalent to missing', () => {
    expect(
      findMatchingView(
        { type: 'income', categoryIds: [], beneficiary: '', accountId: null, search: undefined },
        views
      )?.id
    ).toBe('b');
  });

  it('returns null when nothing matches', () => {
    expect(findMatchingView({ type: 'investment' }, views)).toBeNull();
  });

  it('returns null for empty/invalid view list', () => {
    expect(findMatchingView({ type: 'expense' }, [])).toBeNull();
    expect(findMatchingView({ type: 'expense' }, null)).toBeNull();
  });
});

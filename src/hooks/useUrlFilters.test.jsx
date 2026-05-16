import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useUrlFilters } from './useUrlFilters';

function makeWrapper(initialEntries = ['/']) {
  return function Wrapper({ children }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

function useWithLocation(schema, defaults) {
  const result = useUrlFilters(schema, defaults);
  const location = useLocation();
  return { filters: result[0], setFilters: result[1], location };
}

describe('useUrlFilters', () => {
  const schema = {
    statuses: { array: true },
    devices: { array: true },
    dateFrom: {},
    dateTo: {},
    search: {},
  };
  const defaults = {
    statuses: [],
    devices: [],
    dateFrom: '',
    dateTo: '',
    search: '',
  };

  it('reads defaults when URL has no params', () => {
    const wrapper = makeWrapper(['/']);
    const { result } = renderHook(() => useWithLocation(schema, defaults), { wrapper });
    expect(result.current.filters).toEqual(defaults);
  });

  it('parses single-value params from the URL', () => {
    const wrapper = makeWrapper(['/?dateFrom=2026-01-01&search=swiggy']);
    const { result } = renderHook(() => useWithLocation(schema, defaults), { wrapper });
    expect(result.current.filters.dateFrom).toBe('2026-01-01');
    expect(result.current.filters.search).toBe('swiggy');
  });

  it('parses repeated array params from the URL', () => {
    const wrapper = makeWrapper(['/?statuses=parsed&statuses=pending']);
    const { result } = renderHook(() => useWithLocation(schema, defaults), { wrapper });
    expect(result.current.filters.statuses).toEqual(['parsed', 'pending']);
  });

  it('writes back partial updates as URL params', () => {
    const wrapper = makeWrapper(['/']);
    const { result } = renderHook(() => useWithLocation(schema, defaults), { wrapper });

    act(() => {
      result.current.setFilters({ statuses: ['parsed', 'pending'], search: 'lunch' });
    });

    expect(result.current.location.search).toContain('statuses=parsed');
    expect(result.current.location.search).toContain('statuses=pending');
    expect(result.current.location.search).toContain('search=lunch');
    expect(result.current.filters.statuses).toEqual(['parsed', 'pending']);
  });

  it('drops empty values from the URL on write', () => {
    const wrapper = makeWrapper(['/?search=x']);
    const { result } = renderHook(() => useWithLocation(schema, defaults), { wrapper });

    act(() => {
      result.current.setFilters({ search: '' });
    });

    expect(result.current.location.search).not.toContain('search');
    expect(result.current.filters.search).toBe('');
  });

  it('supports updater-function form like useState', () => {
    const wrapper = makeWrapper(['/?statuses=parsed']);
    const { result } = renderHook(() => useWithLocation(schema, defaults), { wrapper });

    act(() => {
      result.current.setFilters((prev) => ({ ...prev, statuses: [...prev.statuses, 'pending'] }));
    });

    expect(result.current.filters.statuses).toEqual(['parsed', 'pending']);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHideAmounts, __resetHideAmountsForTests } from './useHideAmounts';

describe('useHideAmounts', () => {
  let store;

  // The test env's global localStorage is Node's non-functional stub, so
  // swap in an in-memory one.
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
    __resetHideAmountsForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to shown', () => {
    const { result } = renderHook(() => useHideAmounts());
    expect(result.current[0]).toBe(false);
  });

  it('persists to storage and is read back on a fresh load', () => {
    const { result } = renderHook(() => useHideAmounts());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(store.get('hideAmounts')).toBe('1');

    // A reload re-reads storage.
    __resetHideAmountsForTests();
    expect(renderHook(() => useHideAmounts()).result.current[0]).toBe(true);

    act(() => result.current[1]());
    expect(store.has('hideAmounts')).toBe(false);
  });

  it('keeps every mounted user in sync', () => {
    const netWorthCard = renderHook(() => useHideAmounts());
    const thisMonthCard = renderHook(() => useHideAmounts());
    act(() => netWorthCard.result.current[1]());
    expect(thisMonthCard.result.current[0]).toBe(true);
  });
});

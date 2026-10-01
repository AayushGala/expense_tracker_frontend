import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHideAmounts } from './useHideAmounts';

describe('useHideAmounts', () => {
  // The test env's global localStorage is Node's non-functional stub, so
  // swap in an in-memory one.
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to shown', () => {
    const { result } = renderHook(() => useHideAmounts());
    expect(result.current[0]).toBe(false);
  });

  it('remembers hidden across remounts (reload)', () => {
    const first = renderHook(() => useHideAmounts());
    act(() => first.result.current[1]());
    expect(first.result.current[0]).toBe(true);
    first.unmount();

    const second = renderHook(() => useHideAmounts());
    expect(second.result.current[0]).toBe(true);

    act(() => second.result.current[1]());
    second.unmount();
    expect(renderHook(() => useHideAmounts()).result.current[0]).toBe(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscapeKey } from './useEscapeKey';

function dispatchEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

describe('useEscapeKey', () => {
  it('fires the handler on ESC when active', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(true, handler));
    dispatchEscape();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire when inactive', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(false, handler));
    dispatchEscape();
    expect(handler).not.toHaveBeenCalled();
  });

  it('only fires the topmost handler when stacked', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { unmount: unmountInner } = renderHook(() => useEscapeKey(true, inner));
    const { unmount: unmountOuter } = renderHook(() => useEscapeKey(true, outer));

    // The hook called LAST is the topmost — but the second renderHook above
    // mounted second. So outer should fire first.
    dispatchEscape();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).not.toHaveBeenCalled();

    unmountOuter();
    dispatchEscape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);

    unmountInner();
    dispatchEscape();
    // Neither handler should fire after both unmount
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('uses the latest handler closure even when active does not change', () => {
    let captured = 0;
    function ParentHook({ value }) {
      useEscapeKey(true, () => { captured = value; });
    }
    const { rerender } = renderHook(({ value }) => ParentHook({ value }), {
      initialProps: { value: 1 },
    });
    dispatchEscape();
    expect(captured).toBe(1);

    rerender({ value: 42 });
    dispatchEscape();
    expect(captured).toBe(42);
  });
});

import { describe, expect, it } from 'vitest';
import { isDateClosed, lastMonthEnd } from './bookClose';

describe('isDateClosed', () => {
  it('locks dates on or before the cutoff', () => {
    expect(isDateClosed('2026-04-30', '2026-04-30')).toBe(true);
    expect(isDateClosed('2026-04-01', '2026-04-30')).toBe(true);
    expect(isDateClosed('2026-05-01', '2026-04-30')).toBe(false);
  });

  it('everything is open when books were never closed', () => {
    expect(isDateClosed('2026-04-01', null)).toBe(false);
    expect(isDateClosed('2026-04-01', undefined)).toBe(false);
  });

  it('handles missing dates', () => {
    expect(isDateClosed(null, '2026-04-30')).toBe(false);
  });
});

describe('lastMonthEnd', () => {
  it('returns the last day of the previous month', () => {
    expect(lastMonthEnd(new Date(2026, 6, 11))).toBe('2026-06-30');  // Jul → 30 Jun
    expect(lastMonthEnd(new Date(2026, 2, 1))).toBe('2026-02-28');   // Mar → 28 Feb
    expect(lastMonthEnd(new Date(2026, 0, 15))).toBe('2025-12-31');  // Jan → 31 Dec
  });
});

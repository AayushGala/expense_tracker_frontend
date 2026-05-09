import { describe, it, expect } from 'vitest';
import {
  toDateStr,
  getThisMonthRange,
  getPreviousMonthRange,
  getLastNMonthsRange,
  getFinancialYearRange,
  detectPreset,
  DATE_PRESETS,
} from './datePresets';

describe('toDateStr', () => {
  it('formats date as YYYY-MM-DD with zero padding', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('getThisMonthRange', () => {
  it('returns 1st to last day of the current month', () => {
    const today = new Date(2026, 3, 18); // Apr 18, 2026
    expect(getThisMonthRange(today)).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });
  });

  it('handles February in a non-leap year', () => {
    const today = new Date(2026, 1, 15); // Feb 15, 2026
    expect(getThisMonthRange(today)).toEqual({
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    });
  });

  it('handles February in a leap year', () => {
    const today = new Date(2024, 1, 15); // Feb 15, 2024 (leap year)
    expect(getThisMonthRange(today)).toEqual({
      dateFrom: '2024-02-01',
      dateTo: '2024-02-29',
    });
  });
});

describe('getPreviousMonthRange', () => {
  it('returns 1st to last day of the previous calendar month', () => {
    const today = new Date(2026, 3, 18); // Apr 18, 2026
    expect(getPreviousMonthRange(today)).toEqual({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    });
  });

  it('rolls over to December of the previous year when in January', () => {
    const today = new Date(2026, 0, 15); // Jan 15, 2026
    expect(getPreviousMonthRange(today)).toEqual({
      dateFrom: '2025-12-01',
      dateTo: '2025-12-31',
    });
  });

  it('handles February following a leap year correctly', () => {
    const today = new Date(2024, 2, 5); // Mar 5, 2024 (post-leap)
    expect(getPreviousMonthRange(today)).toEqual({
      dateFrom: '2024-02-01',
      dateTo: '2024-02-29',
    });
  });
});

describe('getLastNMonthsRange', () => {
  it('spans the last 3 months ending with current month', () => {
    const today = new Date(2026, 3, 18); // Apr 18, 2026
    // 3 months = Feb, Mar, Apr
    expect(getLastNMonthsRange(3, today)).toEqual({
      dateFrom: '2026-02-01',
      dateTo: '2026-04-30',
    });
  });

  it('spans the last 6 months ending with current month', () => {
    const today = new Date(2026, 3, 18); // Apr 18, 2026
    // 6 months = Nov 2025 → Apr 2026
    expect(getLastNMonthsRange(6, today)).toEqual({
      dateFrom: '2025-11-01',
      dateTo: '2026-04-30',
    });
  });

  it('handles year rollover correctly', () => {
    const today = new Date(2026, 0, 15); // Jan 15, 2026
    // 3 months = Nov 2025, Dec 2025, Jan 2026
    expect(getLastNMonthsRange(3, today)).toEqual({
      dateFrom: '2025-11-01',
      dateTo: '2026-01-31',
    });
  });
});

describe('getFinancialYearRange', () => {
  it('returns Apr 1 → Mar 31 when in first half of FY (Apr-Dec)', () => {
    const today = new Date(2026, 3, 18); // Apr 18, 2026
    expect(getFinancialYearRange(today)).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2027-03-31',
    });
  });

  it('returns Apr 1 of previous year → Mar 31 when in second half (Jan-Mar)', () => {
    const today = new Date(2027, 0, 15); // Jan 15, 2027
    expect(getFinancialYearRange(today)).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2027-03-31',
    });
  });

  it('handles exactly Apr 1 (start of FY)', () => {
    const today = new Date(2026, 3, 1); // Apr 1, 2026
    expect(getFinancialYearRange(today)).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2027-03-31',
    });
  });

  it('handles Mar 31 (last day of FY)', () => {
    const today = new Date(2027, 2, 31); // Mar 31, 2027
    expect(getFinancialYearRange(today)).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2027-03-31',
    });
  });
});

describe('detectPreset', () => {
  const today = new Date(2026, 3, 18); // Apr 18, 2026

  it('returns "all" when both dates are empty', () => {
    expect(detectPreset('', '', today)).toBe('all');
    expect(detectPreset(null, null, today)).toBe('all');
    expect(detectPreset(undefined, undefined, today)).toBe('all');
  });

  it('identifies this_month', () => {
    expect(detectPreset('2026-04-01', '2026-04-30', today)).toBe('this_month');
  });

  it('identifies previous_month', () => {
    expect(detectPreset('2026-03-01', '2026-03-31', today)).toBe('previous_month');
  });

  it('identifies last_3_months', () => {
    expect(detectPreset('2026-02-01', '2026-04-30', today)).toBe('last_3_months');
  });

  it('identifies last_6_months', () => {
    expect(detectPreset('2025-11-01', '2026-04-30', today)).toBe('last_6_months');
  });

  it('identifies financial_year', () => {
    expect(detectPreset('2026-04-01', '2027-03-31', today)).toBe('financial_year');
  });

  it('returns "custom" for arbitrary range', () => {
    expect(detectPreset('2026-01-15', '2026-02-20', today)).toBe('custom');
  });

  it('returns "custom" when only one date is set', () => {
    expect(detectPreset('2026-04-01', '', today)).toBe('custom');
    expect(detectPreset('', '2026-04-30', today)).toBe('custom');
  });
});

describe('DATE_PRESETS', () => {
  it('contains all expected presets', () => {
    const values = DATE_PRESETS.map((p) => p.value);
    expect(values).toEqual([
      'this_month',
      'previous_month',
      'last_3_months',
      'last_6_months',
      'financial_year',
      'all',
    ]);
  });

  it('every preset has a label and getRange function', () => {
    for (const preset of DATE_PRESETS) {
      expect(preset.label).toBeTruthy();
      expect(typeof preset.getRange).toBe('function');
      const range = preset.getRange();
      expect(range).toHaveProperty('dateFrom');
      expect(range).toHaveProperty('dateTo');
    }
  });
});

import { describe, it, expect } from 'vitest';
import { D, ZERO, sum, round2, isPositive, abs, Decimal } from './money';

describe('D() coercion', () => {
  it('returns ZERO for null/undefined/empty', () => {
    expect(D(null).toString()).toBe('0');
    expect(D(undefined).toString()).toBe('0');
    expect(D('').toString()).toBe('0');
  });
  it('parses a string amount', () => {
    expect(D('125.50').toString()).toBe('125.5');
  });
  it('passes through Decimal instances unchanged', () => {
    const d = new Decimal('99.99');
    expect(D(d)).toBe(d);
  });
  it('accepts a number', () => {
    expect(D(42).toString()).toBe('42');
  });
});

describe('sum()', () => {
  it('returns ZERO for empty input', () => {
    expect(sum([]).toString()).toBe('0');
  });
  it('adds exactly — the canonical 0.1 + 0.2 test', () => {
    // Plain float arithmetic gives 0.30000000000000004; Decimal gives 0.3.
    expect(sum([D('0.1'), D('0.2')]).toString()).toBe('0.3');
  });
  it('accumulates across many entries without drift', () => {
    const values = new Array(10).fill(D('0.1'));
    expect(sum(values).toString()).toBe('1');
  });
  it('handles mixed strings, numbers, and Decimals', () => {
    expect(sum(['10.25', 5, D('0.5')]).toString()).toBe('15.75');
  });
});

describe('round2()', () => {
  it('rounds to two decimal places (banker\'s rounding)', () => {
    expect(round2('1.005').toString()).toBe('1');   // 1.005 → 1.00 (round-half-even)
    expect(round2('1.015').toString()).toBe('1.02'); // 1.015 → 1.02
    expect(round2('2.5').toString()).toBe('2.5');
  });
});

describe('isPositive()', () => {
  it('returns true for positive', () => {
    expect(isPositive('5')).toBe(true);
  });
  it('returns false for zero/negative/nullish', () => {
    expect(isPositive(0)).toBe(false);
    expect(isPositive('-1')).toBe(false);
    expect(isPositive(null)).toBe(false);
  });
});

describe('abs()', () => {
  it('returns absolute value', () => {
    expect(abs('-5.5').toString()).toBe('5.5');
    expect(abs('5.5').toString()).toBe('5.5');
  });
});

describe('ZERO sentinel', () => {
  it('is a Decimal of value 0', () => {
    expect(ZERO.toString()).toBe('0');
    expect(ZERO instanceof Decimal).toBe(true);
  });
});

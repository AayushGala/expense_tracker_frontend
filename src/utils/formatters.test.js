import { describe, it, expect } from 'vitest';
import { formatINR, formatDate, transactionTypeLabel } from './formatters';

// ---------------------------------------------------------------------------
// formatINR
// ---------------------------------------------------------------------------

describe('formatINR', () => {
  it('formats zero', () => {
    expect(formatINR(0)).toContain('0.00');
  });

  it('formats a positive number with Indian grouping', () => {
    const result = formatINR(125000);
    // Should contain the digits grouped as 1,25,000.00
    expect(result).toContain('1,25,000.00');
  });

  it('formats a negative number', () => {
    const result = formatINR(-500);
    expect(result).toContain('500.00');
    // Negative indicator (minus sign or parentheses depending on locale)
    expect(result).toMatch(/-|[()]/);
  });

  it('formats a large number correctly', () => {
    const result = formatINR(10000000);
    // 1,00,00,000.00 in Indian numbering
    expect(result).toContain('1,00,00,000.00');
  });

  it('formats a decimal number with two fraction digits', () => {
    const result = formatINR(1234.5);
    expect(result).toContain('1,234.50');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats an ISO date string into dd Mon yyyy', () => {
    const result = formatDate('2026-03-19');
    // Expected: "19 Mar 2026"
    expect(result).toBe('19 Mar 2026');
  });

  it('formats a Date object', () => {
    // Use a UTC date to avoid timezone issues
    const result = formatDate('2025-12-25');
    expect(result).toBe('25 Dec 2025');
  });

  it('formats a date with single-digit day', () => {
    const result = formatDate('2026-01-05');
    expect(result).toBe('05 Jan 2026');
  });
});

// ---------------------------------------------------------------------------
// transactionTypeLabel
// ---------------------------------------------------------------------------

describe('transactionTypeLabel', () => {
  it.each([
    ['expense',       'Expense'],
    ['income',        'Income'],
    ['transfer',      'Transfer'],
    ['bill_payment',  'Bill Payment'],
    ['investment',    'Investment'],
    ['split_expense', 'Split Expense'],
    ['reimbursement', 'Reimbursement'],
  ])('maps %s -> %s', (type, label) => {
    expect(transactionTypeLabel(type)).toBe(label);
  });

  it('returns the raw type string for an unknown type', () => {
    expect(transactionTypeLabel('something_unknown')).toBe('something_unknown');
  });
});

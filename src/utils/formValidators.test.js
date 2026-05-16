import { describe, it, expect } from 'vitest';
import {
  validateAmount,
  validateOptionalAmount,
  validateDate,
  validateRequired,
  validateDifferentAccounts,
  collectErrors,
} from './formValidators';

describe('validateAmount', () => {
  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
    ['zero string', '0'],
    ['zero number', 0],
    ['negative', '-5'],
    ['non-numeric', 'abc'],
  ])('rejects %s', (_label, value) => {
    expect(validateAmount(value)).toBeTruthy();
  });

  it.each([
    ['positive integer string', '100'],
    ['positive decimal string', '99.99'],
  ])('accepts %s', (_label, value) => {
    expect(validateAmount(value)).toBeNull();
  });

  it('honors a custom message', () => {
    expect(validateAmount('', { message: 'Enter a total.' })).toBe('Enter a total.');
  });
});

describe('validateOptionalAmount', () => {
  it.each([
    ['empty string', ''],
    ['null', null],
    ['zero (fee can be zero)', '0'],
  ])('accepts %s', (_label, value) => {
    expect(validateOptionalAmount(value)).toBeNull();
  });

  it.each([
    ['negative', '-1'],
    ['non-numeric', 'abc'],
  ])('rejects %s', (_label, value) => {
    expect(validateOptionalAmount(value)).toBeTruthy();
  });
});

describe('validateDate', () => {
  it('rejects empty', () => {
    expect(validateDate('')).toBe('Date is required.');
  });
  it('accepts a date string', () => {
    expect(validateDate('2026-05-15')).toBeNull();
  });
});

describe('validateRequired', () => {
  it('rejects empty/null', () => {
    expect(validateRequired('')).toBeTruthy();
    expect(validateRequired(null)).toBeTruthy();
    expect(validateRequired(undefined)).toBeTruthy();
  });
  it('accepts any non-empty value', () => {
    expect(validateRequired('x')).toBeNull();
    expect(validateRequired(0)).toBeNull();
    expect(validateRequired(false)).toBeNull();
  });
});

describe('validateDifferentAccounts', () => {
  it('passes when one side is empty', () => {
    expect(validateDifferentAccounts('', '5')).toBeNull();
    expect(validateDifferentAccounts('3', '')).toBeNull();
  });
  it('passes when accounts differ', () => {
    expect(validateDifferentAccounts('3', '5')).toBeNull();
  });
  it('fails when both sides are the same id', () => {
    expect(validateDifferentAccounts('3', '3')).toBeTruthy();
  });
  it('compares as strings (handles number vs string id)', () => {
    expect(validateDifferentAccounts(3, '3')).toBeTruthy();
  });
});

describe('collectErrors', () => {
  it('returns empty when all validators pass', () => {
    expect(collectErrors({
      amount: null,
      date: null,
    })).toEqual({});
  });
  it('skips null entries, keeps truthy ones', () => {
    expect(collectErrors({
      amount: null,
      date: 'Required',
      account: 'Select an account.',
    })).toEqual({
      date: 'Required',
      account: 'Select an account.',
    });
  });
});

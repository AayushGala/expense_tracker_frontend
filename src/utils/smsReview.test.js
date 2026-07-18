import { describe, expect, it } from 'vitest';
import {
  buildConfirmPayload,
  buildTransactionPayload,
  resolveOwner,
  valuesFromParsedSms,
  valuesFromTransaction,
  windowDateFrom,
} from './smsReview';

const ACCOUNTS = [
  { id: 1, name: 'HDFC', owner: 'Aayush' },
  { id: 2, name: 'ICICI CC', owner: 'Aditi' },
  { id: 3, name: 'Cash', owner: '' },
];

describe('windowDateFrom', () => {
  const today = new Date(2026, 6, 4); // 4 Jul 2026 local

  it('is inclusive of today', () => {
    expect(windowDateFrom('1', today)).toBe('2026-07-04');
    expect(windowDateFrom('3', today)).toBe('2026-07-02');
    expect(windowDateFrom('7', today)).toBe('2026-06-28');
  });

  it('returns empty for all-time and unknown values', () => {
    expect(windowDateFrom('all', today)).toBe('');
    expect(windowDateFrom('bogus', today)).toBe('');
  });
});

describe('valuesFromTransaction', () => {
  it('maps an expense (amount from category debit, from-account from credit)', () => {
    const values = valuesFromTransaction({
      type: 'expense', date: '2026-07-01', category: 9, owner: 'Aayush',
      beneficiary: 'Swiggy', tags: 'food', entries: [
        { entry_type: 'DEBIT', account_id: null, category_id: 9, amount: '450.00' },
        { entry_type: 'CREDIT', account_id: 1, category_id: null, amount: '450.00' },
      ],
    });
    expect(values.amount).toBe('450.00');
    expect(values.from_account_id).toBe('1');
    expect(values.category_id).toBe('9');
    expect(values.tags).toBe('food');
  });

  it('maps a transfer with fee', () => {
    const values = valuesFromTransaction({
      type: 'transfer', date: '2026-07-01', category: null, entries: [
        { entry_type: 'DEBIT', account_id: 3, category_id: null, amount: '1000.00' },
        { entry_type: 'DEBIT', account_id: null, category_id: 7, amount: '25.00' },
        { entry_type: 'CREDIT', account_id: 1, category_id: null, amount: '1025.00' },
      ],
    });
    expect(values.amount).toBe('1000.00');
    expect(values.to_account_id).toBe('3');
    expect(values.from_account_id).toBe('1');
    expect(values.fee).toBe('25.00');
    expect(values.fee_category_id).toBe('7');
  });

  it('maps income (amount and to-account from the account debit)', () => {
    const values = valuesFromTransaction({
      type: 'income', date: '2026-07-01', category: 5, entries: [
        { entry_type: 'DEBIT', account_id: 1, category_id: null, amount: '90000.00' },
        { entry_type: 'CREDIT', account_id: null, category_id: 5, amount: '90000.00' },
      ],
    });
    expect(values.amount).toBe('90000.00');
    expect(values.to_account_id).toBe('1');
  });
});

describe('resolveOwner', () => {
  it('explicit owner wins', () => {
    expect(resolveOwner({ owner: 'Aditi', type: 'expense', from_account_id: '1' }, ACCOUNTS)).toBe('Aditi');
  });

  it('derives from from-account for spends', () => {
    expect(resolveOwner({ owner: '', type: 'expense', from_account_id: '1' }, ACCOUNTS)).toBe('Aayush');
  });

  it('derives from to-account for income', () => {
    expect(resolveOwner({ owner: '', type: 'income', to_account_id: '2' }, ACCOUNTS)).toBe('Aditi');
  });

  it('blank when the account has no owner', () => {
    expect(resolveOwner({ owner: '', type: 'expense', from_account_id: '3' }, ACCOUNTS)).toBe('');
  });
});

describe('buildTransactionPayload', () => {
  it('builds a complete expense PUT payload with derived owner', () => {
    const payload = buildTransactionPayload({
      type: 'expense', date: '2026-07-01', amount: '450.00',
      from_account_id: '1', category_id: '9', owner: '',
      beneficiary: 'Swiggy', description: '', platform: 'UPI',
      tags: 'food', notes: '',
    }, ACCOUNTS);
    expect(payload).toMatchObject({
      type: 'expense', amount: '450.00', from_account_id: 1, category_id: 9,
      owner: 'Aayush', platform: 'UPI', tags: 'food',
    });
    expect(payload).not.toHaveProperty('to_account_id');
  });

  it('keeps transfer fee fields', () => {
    const payload = buildTransactionPayload({
      type: 'transfer', date: '2026-07-01', amount: '1000',
      from_account_id: '1', to_account_id: '3', owner: '',
      fee: '25.00', fee_category_id: '7',
    }, ACCOUNTS);
    expect(payload.fee).toBe('25.00');
    expect(payload.fee_category_id).toBe(7);
  });
});

describe('buildConfirmPayload', () => {
  it('omits empty fields so backend fallbacks apply', () => {
    const payload = buildConfirmPayload({
      type: 'expense', amount: '500', date: '2026-07-04',
      from_account_id: '1', category_id: '', beneficiary: '', owner: '',
    });
    expect(payload).toEqual({
      type: 'expense', amount: '500', date: '2026-07-04', from_account_id: 1,
    });
  });
});

describe('valuesFromParsedSms', () => {
  it('prefers parsed_type and prefills ids as strings', () => {
    const values = valuesFromParsedSms({
      parsed_type: 'bill_payment', parsed_direction: 'debit',
      parsed_amount: '30391.97', parsed_date: '2026-06-04',
      parsed_account: 4, parsed_to_account: 6, parsed_category: null,
    });
    expect(values.type).toBe('bill_payment');
    expect(values.from_account_id).toBe('4');
    expect(values.to_account_id).toBe('6');
  });

  it('falls back to direction when parsed_type is unsupported', () => {
    const values = valuesFromParsedSms({ parsed_type: '', parsed_direction: 'credit' });
    expect(values.type).toBe('income');
  });
});

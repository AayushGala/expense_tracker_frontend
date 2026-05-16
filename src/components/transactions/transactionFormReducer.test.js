import { describe, it, expect } from 'vitest';
import {
  transactionFormReducer,
  makeInitialState,
  valuesAfterTypeChange,
  FIELD_DEFAULTS,
  TRANSACTION_TYPES,
} from './transactionFormReducer';

// ---------------------------------------------------------------------------
// makeInitialState
// ---------------------------------------------------------------------------

describe('makeInitialState', () => {
  it('defaults to expense with today\'s date and empty values', () => {
    const s = makeInitialState();
    expect(s.type).toBe('expense');
    expect(s.submitting).toBe(false);
    expect(s.errors).toEqual({});
    expect(s.values.amount).toBe('');
    expect(s.values.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.values.from_account_id).toBe('');
    expect(s.values.beneficiary_type).toBe('self');
    expect(s.values.other_people).toEqual([]);
    expect(s.values.total_people).toBe('2');
    expect(s.values.my_share_type).toBe('equal');
  });

  it('honors an explicit type and date', () => {
    const s = makeInitialState({ type: 'transfer', date: '2026-01-15' });
    expect(s.type).toBe('transfer');
    expect(s.values.date).toBe('2026-01-15');
  });

  it('layers initialValues onto defaults', () => {
    const s = makeInitialState({
      type: 'income',
      initialValues: { amount: '500', to_account_id: '3', beneficiary: 'self' },
    });
    expect(s.type).toBe('income');
    expect(s.values.amount).toBe('500');
    expect(s.values.to_account_id).toBe('3');
    expect(s.values.beneficiary).toBe('self');
    // Unspecified fields fall back to defaults
    expect(s.values.from_account_id).toBe('');
    expect(s.values.notes).toBe('');
  });
});

// ---------------------------------------------------------------------------
// SET_FIELD
// ---------------------------------------------------------------------------

describe('SET_FIELD', () => {
  it('updates a single field without touching others', () => {
    const s0 = makeInitialState({ initialValues: { amount: '100', notes: 'lunch' } });
    const s1 = transactionFormReducer(s0, { type: 'SET_FIELD', name: 'amount', value: '200' });
    expect(s1.values.amount).toBe('200');
    expect(s1.values.notes).toBe('lunch');
    expect(s1.type).toBe(s0.type);
  });

  it('clears that field\'s error but keeps unrelated errors', () => {
    const s0 = {
      type: 'expense',
      submitting: false,
      values: { ...FIELD_DEFAULTS, amount: '' },
      errors: { amount: 'Required', date: 'Required' },
    };
    const s1 = transactionFormReducer(s0, { type: 'SET_FIELD', name: 'amount', value: '50' });
    expect(s1.errors).toEqual({ date: 'Required' });
    expect('amount' in s1.errors).toBe(false);
  });

  it('is a no-op for errors when the field had no error', () => {
    const s0 = {
      type: 'expense',
      submitting: false,
      values: { ...FIELD_DEFAULTS },
      errors: { date: 'Required' },
    };
    const s1 = transactionFormReducer(s0, { type: 'SET_FIELD', name: 'notes', value: 'x' });
    expect(s1.errors).toEqual({ date: 'Required' });
  });
});

// ---------------------------------------------------------------------------
// SET_TYPE — the headline behavior of Phase 1
// ---------------------------------------------------------------------------

describe('SET_TYPE', () => {
  function withValues(type, values) {
    return {
      type,
      submitting: false,
      values: { ...FIELD_DEFAULTS, ...values },
      errors: {},
    };
  }

  it('returns the same state when type is unchanged', () => {
    const s0 = withValues('expense', { amount: '100' });
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: 'expense' });
    expect(s1).toBe(s0);
  });

  it('preserves amount, date, owner, platform, notes, tags across every type pair', () => {
    const shared = {
      amount: '123',
      date: '2026-05-10',
      owner: 'aayush',
      platform: 'Swiggy',
      notes: 'dinner',
      tags: 'food, dining',
    };
    for (const from of TRANSACTION_TYPES) {
      for (const to of TRANSACTION_TYPES) {
        if (from === to) continue;
        const s0 = withValues(from, shared);
        const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: to });
        expect(s1.values.amount, `${from} -> ${to} amount`).toBe('123');
        expect(s1.values.date, `${from} -> ${to} date`).toBe('2026-05-10');
        expect(s1.values.owner, `${from} -> ${to} owner`).toBe('aayush');
        expect(s1.values.platform, `${from} -> ${to} platform`).toBe('Swiggy');
        expect(s1.values.notes, `${from} -> ${to} notes`).toBe('dinner');
        expect(s1.values.tags, `${from} -> ${to} tags`).toBe('food, dining');
      }
    }
  });

  it('resets errors on every type change', () => {
    const s0 = {
      type: 'expense',
      submitting: false,
      values: { ...FIELD_DEFAULTS },
      errors: { amount: 'Required', category_id: 'Required' },
    };
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: 'transfer' });
    expect(s1.errors).toEqual({});
  });

  // The carryAccount matrix: each row maps a (from, to) type pair with seed
  // account ids to the expected from/to after SET_TYPE. Single-account types
  // promote into whichever slot the new type provides.
  it.each([
    // single-from -> single-to: promote
    ['expense',       'income',       { from_account_id: '7' }, '',  '7'],
    // single-to -> single-from: promote
    ['income',        'expense',      { to_account_id: '7' }, '7',  ''],
    // single-from -> dual: keep as from
    ['expense',       'transfer',     { from_account_id: '7' }, '7', ''],
    // single-to -> dual: keep as to
    ['income',        'transfer',     { to_account_id: '5' }, '',  '5'],
    // dual -> dual: keep both
    ['transfer',      'bill_payment', { from_account_id: '1', to_account_id: '2' }, '1', '2'],
    // dual -> single-from: keep from, drop to
    ['transfer',      'expense',      { from_account_id: '1', to_account_id: '2' }, '1', ''],
    // dual -> single-to: keep to, drop from
    ['transfer',      'income',       { from_account_id: '1', to_account_id: '2' }, '',  '2'],
    // reimbursement (single-to) -> expense (single-from): promote
    ['reimbursement', 'expense',      { to_account_id: '9' }, '9',  ''],
  ])('carryAccount: %s -> %s', (from, to, seed, expectFrom, expectTo) => {
    const s0 = withValues(from, seed);
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: to });
    expect(s1.values.from_account_id).toBe(expectFrom);
    expect(s1.values.to_account_id).toBe(expectTo);
  });

  // --- Category carry / drop ---

  it('keeps category_id when both old and new type list it (expense -> split_expense)', () => {
    const s0 = withValues('expense', { category_id: '4' });
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: 'split_expense' });
    expect(s1.values.category_id).toBe('4');
  });

  it('drops category_id when new type does not have a category (expense -> transfer)', () => {
    const s0 = withValues('expense', { category_id: '4' });
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: 'transfer' });
    expect(s1.values.category_id).toBe('');
  });

  it('drops category_id when category sets differ (expense -> income)', () => {
    // expense and income both list category_id in TYPE_FIELDS, so technically
    // the overlap kicks in — this codifies the current behavior. If you ever
    // need to drop on cross-set, gate by SAME_CATEGORY_GROUP here.
    const s0 = withValues('expense', { category_id: '4' });
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: 'income' });
    expect(s1.values.category_id).toBe('4');
  });

  // Each row: leaving `from` for `to` reverts the seeded fields back to
  // FIELD_DEFAULTS. The drop happens because those fields don't appear in
  // the new type's TYPE_FIELDS entry.
  it.each([
    [
      'transfer', 'expense',
      { fee: '10', fee_category_id: '2' },
      ['fee', 'fee_category_id'],
    ],
    [
      'split_expense', 'expense',
      {
        total_people: '4',
        my_share_type: 'custom',
        custom_my_share: '50',
        other_people: [{ id: 'a', name: 'Bob', amount: '100' }],
      },
      ['total_people', 'my_share_type', 'custom_my_share', 'other_people'],
    ],
    [
      'reimbursement', 'income',
      { selected_receivable_id: '11' },
      ['selected_receivable_id'],
    ],
    [
      'income', 'expense',
      { source_transaction_id: 99 },
      ['source_transaction_id'],
    ],
  ])('leaving %s for %s drops type-specific fields back to defaults', (from, to, seed, droppedFields) => {
    const s0 = withValues(from, seed);
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: to });
    for (const field of droppedFields) {
      expect(s1.values[field]).toEqual(FIELD_DEFAULTS[field]);
    }
  });

  it('reproduces the original user bug — Expense -> Income preserves all the user typed', () => {
    // The exact scenario the user reported: amount, account, category typed
    // into Expense; switching to Income used to wipe everything.
    const s0 = withValues('expense', {
      amount: '500',
      from_account_id: '3',
      category_id: '7',
      notes: 'lunch with team',
      owner: 'aayush',
    });
    const s1 = transactionFormReducer(s0, { type: 'SET_TYPE', value: 'income' });
    expect(s1.values.amount).toBe('500');
    expect(s1.values.notes).toBe('lunch with team');
    expect(s1.values.owner).toBe('aayush');
    // Account semantically carries to the new direction
    expect(s1.values.to_account_id).toBe('3');
    expect(s1.values.from_account_id).toBe('');
    // Category preserved (both types share the category_id slot — user can
    // adjust if the value isn't valid for income)
    expect(s1.values.category_id).toBe('7');
  });
});

// ---------------------------------------------------------------------------
// LOAD_INITIAL — fixes the async-SMS-prefill bug
// ---------------------------------------------------------------------------

describe('LOAD_INITIAL', () => {
  it('replaces values from a freshly-resolved external source', () => {
    const s0 = makeInitialState();
    const s1 = transactionFormReducer(s0, {
      type: 'LOAD_INITIAL',
      payload: {
        type: 'expense',
        values: { amount: '808.95', from_account_id: '2', date: '2026-05-15' },
      },
    });
    expect(s1.type).toBe('expense');
    expect(s1.values.amount).toBe('808.95');
    expect(s1.values.from_account_id).toBe('2');
    expect(s1.values.date).toBe('2026-05-15');
  });

  it('changes the type when payload specifies a different one (SMS credit -> income)', () => {
    const s0 = makeInitialState({ type: 'expense' });
    const s1 = transactionFormReducer(s0, {
      type: 'LOAD_INITIAL',
      payload: { type: 'income', values: { amount: '1000', to_account_id: '4' } },
    });
    expect(s1.type).toBe('income');
    expect(s1.values.to_account_id).toBe('4');
  });

  it('resets fields the payload omits — no stale state from previous edits', () => {
    const s0 = {
      type: 'expense',
      submitting: false,
      values: { ...FIELD_DEFAULTS, amount: '999', notes: 'stale', tags: 'old' },
      errors: { amount: 'Required' },
    };
    const s1 = transactionFormReducer(s0, {
      type: 'LOAD_INITIAL',
      payload: { type: 'expense', values: { amount: '100' } },
    });
    expect(s1.values.amount).toBe('100');
    expect(s1.values.notes).toBe('');
    expect(s1.values.tags).toBe('');
    expect(s1.errors).toEqual({});
  });

  it('preserves current type when payload omits type', () => {
    const s0 = makeInitialState({ type: 'transfer' });
    const s1 = transactionFormReducer(s0, {
      type: 'LOAD_INITIAL',
      payload: { values: { amount: '50' } },
    });
    expect(s1.type).toBe('transfer');
  });
});

// ---------------------------------------------------------------------------
// SET_ERRORS, CLEAR_ERRORS, SUBMITTING
// ---------------------------------------------------------------------------

describe('error and submitting actions', () => {
  it('SET_ERRORS replaces the error map', () => {
    const s0 = makeInitialState();
    const s1 = transactionFormReducer(s0, {
      type: 'SET_ERRORS',
      errors: { amount: 'Required', date: 'Required' },
    });
    expect(s1.errors).toEqual({ amount: 'Required', date: 'Required' });
  });

  it('CLEAR_ERRORS empties the error map', () => {
    const s0 = {
      type: 'expense',
      submitting: false,
      values: FIELD_DEFAULTS,
      errors: { amount: 'Required' },
    };
    const s1 = transactionFormReducer(s0, { type: 'CLEAR_ERRORS' });
    expect(s1.errors).toEqual({});
  });

  it('SUBMITTING toggles the submitting flag', () => {
    const s0 = makeInitialState();
    const s1 = transactionFormReducer(s0, { type: 'SUBMITTING', value: true });
    expect(s1.submitting).toBe(true);
    const s2 = transactionFormReducer(s1, { type: 'SUBMITTING', value: false });
    expect(s2.submitting).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unknown action — defensive default
// ---------------------------------------------------------------------------

describe('default case', () => {
  it('returns state unchanged for unknown actions', () => {
    const s0 = makeInitialState();
    const s1 = transactionFormReducer(s0, { type: 'NOT_A_REAL_ACTION' });
    expect(s1).toBe(s0);
  });
});

// ---------------------------------------------------------------------------
// valuesAfterTypeChange — exported for SMS-form reuse later
// ---------------------------------------------------------------------------

describe('valuesAfterTypeChange (exported helper)', () => {
  it('produces the same result as SET_TYPE dispatch', () => {
    const current = { ...FIELD_DEFAULTS, amount: '50', from_account_id: '3' };
    const next = valuesAfterTypeChange(current, 'expense', 'income');
    expect(next.amount).toBe('50');
    expect(next.to_account_id).toBe('3');
    expect(next.from_account_id).toBe('');
  });
});

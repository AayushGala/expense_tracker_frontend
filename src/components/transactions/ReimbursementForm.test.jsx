import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { D } from '../../utils/money';
import { makeInitialState } from './transactionFormReducer';

const row = (id, amount, name = 'Aditi') => ({ id, person_name: name, amount: D(amount) });

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    accounts: [
      { id: 9, name: 'Receivable', type: 'receivable' },
      { id: 1, name: 'HDFC', type: 'asset' },
    ],
    categories: [{ id: 60, name: 'Lost & Found', type: 'expense', role: 'adjustment' }],
    // Aditi: split 700 + 500, then gave 1000 -> owes 200. Janki: we owe 400.
    receivables: [row(1, 700), row(2, 500), row(3, -1000, 'aditi'), row(4, -400, 'Janki')],
    settings: {},
  }),
}));
vi.mock('../../hooks/useReportData', () => ({ usePeople: () => ['Aditi', 'Janki'] }));

import ReimbursementForm from './ReimbursementForm';

function renderForm(values, { onSubmit = vi.fn(), dispatch = vi.fn(), isEditing = false } = {}) {
  const state = makeInitialState({ type: 'reimbursement', initialValues: values });
  render(
    <ReimbursementForm values={state.values} errors={{}} dispatch={dispatch} onSubmit={onSubmit} isEditing={isEditing} />,
  );
  return { onSubmit, dispatch };
}

describe('ReimbursementForm (new)', () => {
  it('shows the running balance with the person, in either direction', () => {
    renderForm({ person_name: 'aditi' });
    expect(screen.getByText('aditi owes you ₹200.00.')).toBeInTheDocument();
  });

  it('shows what you owe and offers to send it back', () => {
    renderForm({ person_name: 'Janki', settle_mode: 'money_out' });
    expect(screen.getByText('You owe Janki ₹400.00.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fill full balance \(₹400\.00\)/ })).toBeInTheDocument();
  });

  it('submits money sent as a settle movement', () => {
    const { onSubmit } = renderForm({ person_name: 'Janki', amount: '400', settle_mode: 'money_out', from_account_id: '1' });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'reimbursement', person_name: 'Janki', mode: 'money_out', amount: '400', from_account_id: 1,
    }));
  });

  it('caps a write-off at the balance', () => {
    const { onSubmit, dispatch } = renderForm({ person_name: 'Aditi', amount: '201', settle_mode: 'write_off', category_id: '60' });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SET_ERRORS', errors: expect.objectContaining({ amount: expect.stringMatching(/₹200\.00/) }),
    }));
  });
});

describe('ReimbursementForm (paid for them)', () => {
  it('sends the account and what it was for', () => {
    const { onSubmit } = renderForm({
      person_name: 'Aditi', amount: '700', settle_mode: 'paid_for_them', from_account_id: '1', for_category_id: '60',
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'reimbursement', mode: 'paid_for_them', from_account_id: 1, category_id: 60,
    }));
  });

  it('saves an edit as a payout that keeps what it was for', () => {
    const { onSubmit } = renderForm(
      { person_name: 'Aditi', amount: '700', settle_mode: 'paid_for_them', from_account_id: '1', for_category_id: '60', receivable_account_id: '9' },
      { isEditing: true },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Update$/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payout', from_account_id: 1, for_category_id: 60,
    }));
  });
});

describe('ReimbursementForm (edit)', () => {
  it('saves a payout as a payout', () => {
    const { onSubmit } = renderForm(
      { person_name: 'Janki', amount: '100', settle_mode: 'money_out', settle_type: 'payout', from_account_id: '1', receivable_account_id: '9' },
      { isEditing: true },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Update$/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payout', person_name: 'Janki', from_account_id: 1, receivable_account_id: 9,
    }));
  });

  it('keeps the direction of a write-off of what you owe', () => {
    const { onSubmit } = renderForm(
      { person_name: 'Janki', amount: '100', settle_mode: 'category', category_id: '60', settle_type: 'payout' },
      { isEditing: true },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Update$/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'payout', category_id: 60 }));
  });
});

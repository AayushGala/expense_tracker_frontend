import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { D } from '../../utils/money';
import { makeInitialState } from './transactionFormReducer';

const receivable = (id, owed, settled = 0, name = 'Aditi') => ({
  id, person_name: name, status: settled ? 'partial' : 'pending',
  amount_owed: D(owed), amount_settled: D(settled),
});

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    accounts: [{ id: 9, name: 'Receivable', type: 'receivable' }],
    categories: [{ id: 60, name: 'Lost & Found', type: 'expense', role: 'adjustment' }],
    receivables: [receivable(1, 4226.4), receivable(2, 28050), receivable(3, 6682, 682), receivable(4, 0, 0, 'Done')],
    settings: {},
  }),
}));

import ReimbursementForm from './ReimbursementForm';

function renderForm(values, onSubmit = vi.fn()) {
  const state = makeInitialState({ type: 'reimbursement', initialValues: values });
  render(
    <ReimbursementForm values={state.values} errors={{}} dispatch={vi.fn()} onSubmit={onSubmit} isEditing={false} />,
  );
  return onSubmit;
}

describe('ReimbursementForm (new)', () => {
  it('offers one total per person instead of one row per split', () => {
    renderForm({ selected_person: 'aditi' });
    // 4226.40 + 28050 + (6682 - 682)
    expect(screen.getByText(/Aditi — ₹38,276\.40 outstanding \(3 splits\)/)).toBeInTheDocument();
    expect(screen.getByText(/Settles the oldest splits first/)).toBeInTheDocument();
  });

  it('submits a per-person settlement', () => {
    const onSubmit = renderForm({ selected_person: 'aditi', amount: '1000', settle_mode: 'write_off', category_id: '60' });
    fireEvent.click(screen.getByRole('button', { name: /Record Reimbursement/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'reimbursement', person_name: 'Aditi', mode: 'write_off', amount: '1000', category_id: 60,
    }));
  });
});

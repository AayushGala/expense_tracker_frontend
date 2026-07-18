import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, getToken } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

async function post(token, payload) {
  const res = await fetch(`${API_BASE}/api/transactions/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${await res.text()}`);
  return res.json();
}

test.beforeEach(async () => {
  await resetState();
});

test('deleting an expense with refunds is blocked with a friendly error', async ({ page }) => {
  const note = `e2e-refund-block-${Date.now()}`;
  const token = await getToken();
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const refundCat = categories.find((c) => c.role === 'refund');

  const expense = await post(token, {
    type: 'expense',
    date: new Date().toISOString().slice(0, 10),
    amount: '500',
    from_account_id: hdfc.id,
    category_id: groceries.id,
    notes: note,
  });
  await post(token, {
    type: 'income',
    date: new Date().toISOString().slice(0, 10),
    amount: '200',
    to_account_id: hdfc.id,
    category_id: refundCat.id,
    source_transaction_id: expense.id,
  });

  // Try to delete via the API — the UI surfaces the same backend error.
  const res = await fetch(`${API_BASE}/api/transactions/${expense.id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Token ${token}` },
  });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/1 refund link/i);
});

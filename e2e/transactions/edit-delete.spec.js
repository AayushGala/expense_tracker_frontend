import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, getToken } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

async function createExpense(token, { amount, notes, accountId, categoryId }) {
  const res = await fetch(`${API_BASE}/api/transactions/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'expense',
      date: '2026-05-17',
      amount,
      from_account_id: accountId,
      category_id: categoryId,
      notes,
    }),
  });
  return res.json();
}

test.beforeEach(async () => {
  await resetState();
});

test('edit an existing transaction via the UI', async ({ page }) => {
  const note = `e2e-edit-${Date.now()}`;
  const token = await getToken();
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const txn = await createExpense(token, {
    amount: '500',
    notes: note,
    accountId: hdfc.id,
    categoryId: groceries.id,
  });

  await page.goto('/transactions');
  await page.getByRole('table').getByText(note).click();
  // Detail drawer opens with an Edit button (handleEdit navigates).
  await page.getByRole('button', { name: /^edit$/i }).click();

  await expect(page).toHaveURL(new RegExp(`/transactions/${txn.id}/edit$`));
  await page.getByLabel('Amount').fill('999');
  await page.getByRole('button', { name: /update expense/i }).click();

  await expect(page.getByText(/transaction updated/i)).toBeVisible({ timeout: 15_000 });

  // Re-fetch and assert the amount changed.
  const res = await fetch(`${API_BASE}/api/transactions/${txn.id}/`, {
    headers: { Authorization: `Token ${token}` },
  });
  const updated = await res.json();
  const credit = updated.entries.find((e) => e.entry_type === 'CREDIT');
  expect(Number(credit.amount)).toBe(999);
});

test('delete a transaction via the UI', async ({ page }) => {
  const note = `e2e-delete-${Date.now()}`;
  const token = await getToken();
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const txn = await createExpense(token, {
    amount: '250',
    notes: note,
    accountId: hdfc.id,
    categoryId: groceries.id,
  });

  await page.goto('/transactions');
  await page.getByRole('table').getByText(note).click();
  // Confirm-on-delete; intercept the browser dialog.
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /delete/i }).click();

  await expect(page.getByRole('table').getByText(note)).toBeHidden();

  // Verify gone server-side too.
  const res = await fetch(`${API_BASE}/api/transactions/${txn.id}/`, {
    headers: { Authorization: `Token ${token}` },
  });
  expect(res.status).toBe(404);
});

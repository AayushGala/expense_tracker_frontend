import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createExpense, getToken,
} from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test.beforeEach(async () => {
  await resetState();
});

test('filter state survives a full page reload', async ({ page }) => {
  const stamp = Date.now();
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const cash = accounts.find((a) => a.name === 'Cash');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const salary = categories.find((c) => c.name === 'Salary');
  const token = await getToken();

  const expNote = `e2e-persist-exp-${stamp}`;
  const incNote = `e2e-persist-inc-${stamp}`;
  const xferNote = `e2e-persist-xfer-${stamp}`;
  await createExpense({ amount: '100', notes: expNote, accountId: hdfc.id, categoryId: groceries.id });
  await fetch(`${API_BASE}/api/transactions/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'income', date: '2026-05-17', amount: '5000',
      to_account_id: hdfc.id, category_id: salary.id, notes: incNote,
    }),
  });
  await fetch(`${API_BASE}/api/transactions/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'transfer', date: '2026-05-17', amount: '500',
      from_account_id: hdfc.id, to_account_id: cash.id, notes: xferNote,
    }),
  });

  // Direct URL with multi-value type filter.
  await page.goto('/transactions?types=expense&types=income');
  await expect(page.getByRole('table').getByText(expNote)).toBeVisible();
  await expect(page.getByRole('table').getByText(incNote)).toBeVisible();
  await expect(page.getByRole('table').getByText(xferNote)).toBeHidden();

  await page.reload();
  // Filter state survived: same URL, same row visibility.
  await expect(page).toHaveURL(/types=expense.*types=income|types=income.*types=expense/);
  await expect(page.getByRole('table').getByText(expNote)).toBeVisible();
  await expect(page.getByRole('table').getByText(incNote)).toBeVisible();
  await expect(page.getByRole('table').getByText(xferNote)).toBeHidden();
});

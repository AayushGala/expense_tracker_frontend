import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createExpense, getToken,
} from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test.beforeEach(async () => {
  await resetState();
});

test('search filter narrows the transactions list', async ({ page }) => {
  const stamp = Date.now();
  const noteA = `e2e-search-A-${stamp}`;
  const noteB = `e2e-search-B-${stamp}`;
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');

  await createExpense({ amount: '111', notes: noteA, accountId: hdfc.id, categoryId: groceries.id });
  await createExpense({ amount: '222', notes: noteB, accountId: hdfc.id, categoryId: groceries.id });

  await page.goto('/transactions');
  await expect(page.getByRole('table').getByText(noteA)).toBeVisible();
  await expect(page.getByRole('table').getByText(noteB)).toBeVisible();

  // TopBar search only submits on Enter — it doesn't bind onChange.
  const search = page.getByPlaceholder(/search transactions/i);
  await search.fill(noteA);
  await search.press('Enter');
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByRole('table').getByText(noteA)).toBeVisible();
  await expect(page.getByRole('table').getByText(noteB)).toBeHidden();
});

test('?types=income URL filter shows only income rows', async ({ page }) => {
  const stamp = Date.now();
  const expenseNote = `e2e-typefilter-exp-${stamp}`;
  const incomeNote = `e2e-typefilter-inc-${stamp}`;

  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const salary = categories.find((c) => c.name === 'Salary');
  const token = await getToken();

  await createExpense({ amount: '500', notes: expenseNote, accountId: hdfc.id, categoryId: groceries.id });
  await fetch(`${API_BASE}/api/transactions/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'income', date: new Date().toISOString().slice(0, 10), amount: '50000',
      to_account_id: hdfc.id, category_id: salary.id, notes: incomeNote,
    }),
  });

  await page.goto('/transactions?types=income');
  await expect(page.getByRole('table').getByText(incomeNote)).toBeVisible();
  await expect(page.getByRole('table').getByText(expenseNote)).toBeHidden();
});

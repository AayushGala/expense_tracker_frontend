import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, createExpense, getToken } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

function monthsAgo(n, day = 2) {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() - n, day);
  const tz = first.getTimezoneOffset() * 60000;
  return new Date(first.getTime() - tz).toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetState();
  const hdfc = (await getAccounts()).find((a) => a.name === 'HDFC Savings');
  const categories = await getCategories();
  const groceries = categories.find((c) => c.name === 'Groceries');
  const salary = categories.find((c) => c.name === 'Salary');
  await createExpense({ amount: 2000, accountId: hdfc.id, categoryId: groceries.id, date: monthsAgo(1) });
  await createExpense({ amount: 500, accountId: hdfc.id, categoryId: groceries.id, date: monthsAgo(0, 1) });
  await fetch(`${API_BASE}/api/transactions/`, {
    method: 'POST',
    headers: { Authorization: `Token ${await getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'income', date: monthsAgo(1), amount: '10000', to_account_id: hdfc.id, category_id: salary.id,
    }),
  });
});

test('trends table drills into a group month and the tab survives the round trip', async ({ page }) => {
  await page.goto('/reports');
  await page.getByRole('button', { name: 'Trends' }).click();
  await expect(page).toHaveURL(/tab=trends/);
  await expect(page.getByRole('button', { name: 'Food & Drink' })).toBeVisible();

  // Last month's Food & Drink cell opens the drill-down for that month.
  await page.getByRole('row', { name: /Food & Drink/ }).getByRole('button', { name: '₹2k' }).click();
  await expect(page).toHaveURL(/\/reports\/categories\/\d+\?.*month=\d{4}-\d{2}/);
  await expect(page.getByRole('heading', { name: 'Food & Drink' })).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/tab=trends/);
  await expect(page.getByRole('button', { name: 'Trends' })).toHaveClass(/border-brand/);
});

test('cashflow shows saved and savings rate; net worth shows today\'s position', async ({ page }) => {
  await page.goto('/reports?tab=cashflow');
  // 10000 income - 2000 spent last month, 500 spent this month.
  await expect(page.getByText('Saved', { exact: true }).locator('..')).toContainText('₹7,500.00');
  await expect(page.getByText('75% of income')).toBeVisible();

  await page.getByRole('button', { name: 'Net Worth' }).click();
  await expect(page.getByText('Net worth now').locator('..')).toContainText('₹7,500.00');
  await expect(page.getByText('One account')).toBeVisible();
});

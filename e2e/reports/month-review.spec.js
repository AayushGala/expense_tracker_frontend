import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, createExpense } from '../helpers/api.js';

function monthsAgo(n, day = 2) {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() - n, day);
  const tz = first.getTimezoneOffset() * 60000;
  return new Date(first.getTime() - tz).toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetState();
});

test('month in review compares with last month and drills into a category', async ({ page }) => {
  const stamp = Date.now();
  const hdfc = (await getAccounts()).find((a) => a.name === 'HDFC Savings');
  const groceries = (await getCategories()).find((c) => c.name === 'Groceries');
  await createExpense({ amount: 1000, notes: `last-${stamp}`, accountId: hdfc.id, categoryId: groceries.id, date: monthsAgo(1) });
  await createExpense({ amount: 1500, notes: `this-${stamp}`, accountId: hdfc.id, categoryId: groceries.id, date: monthsAgo(0, 1) });

  await page.goto('/reports');
  await expect(page.getByRole('button', { name: 'Month in Review' })).toBeVisible();
  await expect(page.getByText('₹1,500.00').first()).toBeVisible();
  // +50% against last month, shown on the Spent card and under Spending more.
  await expect(page.getByText('+50%').first()).toBeVisible();
  await expect(page.getByText('Spending more')).toBeVisible();

  await page.getByRole('button', { name: /^Groceries/ }).first().click();
  await expect(page).toHaveURL(/\/reports\/categories\/\d+\?month=\d{4}-\d{2}/);
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();
  await expect(page.getByText('Month by month')).toBeVisible();

  await page.getByRole('link', { name: 'View all' }).click();
  await expect(page).toHaveURL(/\/transactions\?.*categoryIds=/);
  await expect(page.getByRole('table').getByText(`this-${stamp}`)).toBeVisible();
  await expect(page.getByRole('table').getByText(`last-${stamp}`)).toBeVisible();
});

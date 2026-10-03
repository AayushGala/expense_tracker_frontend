import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, createExpense, postSMS } from './helpers/api.js';

test.describe('dashboard after login', () => {
  test('lands on /, navigation rendered, transactions page reachable', async ({ page }) => {
    await page.goto('/');

    // Side nav should be visible (desktop) or bottom nav (mobile).
    // The Transactions entry exists on both.
    await expect(page.getByRole('link', { name: /transactions/i }).first()).toBeVisible();

    await page.getByRole('link', { name: /transactions/i }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
  });
});

test.describe('dashboard home', () => {
  test.beforeEach(async () => {
    await resetState();
  });

  test('shows this month so far and nudges to review pending SMS', async ({ page }) => {
    const stamp = Date.now();
    const hdfc = (await getAccounts()).find((a) => a.name === 'HDFC Savings');
    const groceries = (await getCategories()).find((c) => c.name === 'Groceries');
    await createExpense({ amount: 750, notes: `dash-${stamp}`, accountId: hdfc.id, categoryId: groceries.id });
    await postSMS({ sender: `AD-DASH-${stamp}`, body: `Rs 120 debited from A/c XX1234 [${stamp}]`, receivedAt: new Date().toISOString() });

    await page.goto('/');
    await expect(page.getByText('spent so far')).toBeVisible();
    await expect(page.getByText('₹750.00').first()).toBeVisible();
    await expect(page.getByText('SMS to review')).toBeVisible();
    await expect(page.getByRole('table').getByText(`dash-${stamp}`)).toBeVisible();

    await page.getByRole('link', { name: 'Month in Review' }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(page.getByText('Biggest changes')).toBeVisible();
  });
});

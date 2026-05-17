import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createExpense, createRefund, getTransaction,
} from '../helpers/api.js';

test.beforeEach(async () => {
  await resetState();
});

test('edit a refund by drilling in from the source expense modal', async ({ page }) => {
  const expenseNote = `e2e-src-expense-${Date.now()}`;
  const refundNote = `e2e-refund-row-${Date.now()}`;

  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const refundCat = categories.find((c) => c.role === 'refund');

  const expense = await createExpense({
    amount: '500', notes: expenseNote, accountId: hdfc.id, categoryId: groceries.id,
  });
  const refund = await createRefund({
    sourceId: expense.id,
    amount: '150',
    toAccountId: hdfc.id,
    categoryId: refundCat.id,
    notes: refundNote,
  });

  await page.goto('/transactions');
  // Open the expense modal.
  await page.getByRole('table').getByText(expenseNote).click();

  // The linked refunds section lists the refund row. Click it to swap the
  // modal contents to show the refund.
  await page.getByRole('button').filter({ hasText: refundNote }).click();

  // Now Edit the refund — modal's Edit button navigates to /transactions/{refund_id}/edit.
  await page.getByRole('button', { name: /^edit$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/transactions/${refund.id}/edit$`));

  await page.getByLabel('Amount').fill('250');
  await page.getByRole('button', { name: /update refund/i }).click();
  await expect(page.getByText(/transaction updated/i)).toBeVisible({ timeout: 15_000 });

  const updated = await getTransaction(refund.id);
  const credit = updated.entries.find((e) => e.entry_type === 'CREDIT');
  expect(Number(credit.amount)).toBe(250);
});

import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createExpense, createRefund,
} from '../helpers/api.js';

test.beforeEach(async () => {
  await resetState();
});

test('expense modal shows summed Refunded section + per-refund rows', async ({ page }) => {
  const note = `e2e-multirefund-${Date.now()}`;
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const refundCat = categories.find((c) => c.role === 'refund');

  const expense = await createExpense({
    amount: '500', notes: note,
    accountId: hdfc.id, categoryId: groceries.id,
  });
  const refundANote = `refund-A-${Date.now()}`;
  const refundBNote = `refund-B-${Date.now()}`;
  await createRefund({
    sourceId: expense.id, amount: '200', toAccountId: hdfc.id,
    categoryId: refundCat.id, notes: refundANote,
  });
  await createRefund({
    sourceId: expense.id, amount: '100', toAccountId: hdfc.id,
    categoryId: refundCat.id, notes: refundBNote,
  });

  await page.goto('/transactions');
  await page.getByRole('table').getByText(note).click();

  // ↩ Refunded · ₹300 (200 + 100). The exact formatINR output may use grouping
  // for larger numbers; a loose regex matches both "300" and "300.00".
  await expect(page.getByText(/↩\s*Refunded\s*·\s*₹\s*300/i)).toBeVisible();

  // Both refund rows are listed (clickable buttons with the notes).
  await expect(page.getByRole('button').filter({ hasText: refundANote })).toBeVisible();
  await expect(page.getByRole('button').filter({ hasText: refundBNote })).toBeVisible();

  // Net: 500 - 300 = 200
  await expect(page.getByText(/net:\s*₹\s*200/i)).toBeVisible();
});

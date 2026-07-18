import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, createExpense } from '../helpers/api.js';

// First day of last month — safely inside the default close date
// (last month's end) that BookCloseManager suggests.
function lastMonthStart() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const tz = first.getTimezoneOffset() * 60000;
  return new Date(first.getTime() - tz).toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  // resetState also reopens any leftover book-closes.
  await resetState();
});

test.afterEach(async () => {
  await resetState();
});

test('close, verify lock on old transaction, reopen', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  const accounts = await getAccounts();
  const groceries = (await getCategories()).find((c) => c.type === 'expense');
  const txn = await createExpense({
    amount: 321, accountId: accounts[0].id, categoryId: groceries.id,
    date: lastMonthStart(), beneficiary: `Closable ${Date.now()}`,
  });

  // Close the books through last month's end (the suggested default date).
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Book Closing' }).click();
  await page.getByRole('button', { name: 'Close Books' }).click();
  await expect(page.getByText(/Books closed through/)).toBeVisible();
  await expect(page.getByText('✓ Verified')).toBeVisible();

  // The old transaction is now read-only: its edit page shows the lock panel.
  await page.goto(`/transactions/${txn.id}/edit`);
  await expect(page.getByText('This transaction is in closed books')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();

  // Reopen restores editability.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Book Closing' }).click();
  await page.getByRole('button', { name: 'Reopen' }).first().click();
  await expect(page.getByText('Books reopened')).toBeVisible();

  await page.goto(`/transactions/${txn.id}/edit`);
  await expect(page.getByText('This transaction is in closed books')).toHaveCount(0);
  await expect(page.getByText('Transaction Type')).toBeVisible();
});

import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createSplitExpense, getTransaction,
} from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

test.beforeEach(async () => {
  await resetState();
});

test('record a reimbursement that settles a receivable', async ({ page }) => {
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const receivableAcct = accounts.find((a) => a.type_name === 'Receivable');

  const split = await createSplitExpense({
    totalAmount: '1000',
    myShare: '500',
    accountId: hdfc.id,
    categoryId: groceries.id,
    receivableAccountId: receivableAcct.id,
    receivables: [{ person_name: 'Rahul', amount_owed: '500' }],
  });
  const receivable = (await getTransaction(split.id)).receivables[0];

  await page.goto('/transactions/new');
  await page.getByRole('button', { name: 'Reimbursement' }).click();
  await expect(page.getByRole('button', { name: /record reimbursement/i })).toBeVisible();

  await pickFromDropdown(
    page,
    page.locator('button:has-text("Choose a person")').first(),
    /Rahul/i,
  );
  await page.getByRole('button', { name: /fill full outstanding/i }).click();
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select account")').first(),
    /HDFC Savings/i,
  );

  await page.getByRole('button', { name: /record reimbursement/i }).click();
  await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 15_000 });

  // Receivable now fully settled.
  const updated = (await getTransaction(split.id)).receivables.find((r) => r.id === receivable.id);
  expect(updated.status).toBe('settled');
});

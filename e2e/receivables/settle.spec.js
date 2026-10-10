import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createSplitExpense, getTransaction,
} from '../helpers/api.js';

test.beforeEach(async () => {
  await resetState();
});

test('a person owing on two splits is written off in one go from the Receivables page', async ({ page }) => {
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const receivableAcct = accounts.find((a) => a.type_name === 'Receivable');

  const splits = [];
  for (const [amount, notes] of [['600', 'Dinner'], ['400', 'Movie']]) {
    splits.push(await createSplitExpense({
      totalAmount: amount, myShare: '0',
      accountId: hdfc.id, categoryId: groceries.id, receivableAccountId: receivableAcct.id,
      receivables: [{ person_name: 'Rahul', amount_owed: amount }], notes,
    }));
  }

  await page.goto('/receivables');
  const card = page.locator('div', { hasText: 'Rahul' }).filter({ hasText: 'still owed' }).first();
  await expect(card.getByText('₹1,000.00').first()).toBeVisible();
  await expect(card.getByText('Dinner')).toBeVisible();
  await expect(card.getByText('Movie')).toBeVisible();

  await card.getByRole('button', { name: 'Write off' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Write off · Rahul/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Write off' }).click();
  await expect(page.getByText(/wrote off ₹1,000\.00/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Settled \(1\)/ }).click();
  await expect(page.getByText('Rahul')).toBeVisible();

  for (const split of splits) {
    const [receivable] = (await getTransaction(split.id)).receivables;
    expect(receivable.status).toBe('settled');
  }
});

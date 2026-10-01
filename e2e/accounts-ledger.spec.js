import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, createExpense } from './helpers/api.js';

test.beforeEach(async () => {
  await resetState();
});

test('account ledger lists newest entries first', async ({ page }) => {
  const stamp = Date.now();
  const hdfc = (await getAccounts()).find((a) => a.name === 'HDFC Savings');
  const groceries = (await getCategories()).find((c) => c.name === 'Groceries');
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await createExpense({ amount: 100, notes: `older-${stamp}`, accountId: hdfc.id, categoryId: groceries.id, date: yesterday });
  await createExpense({ amount: 200, notes: `newer-${stamp}`, accountId: hdfc.id, categoryId: groceries.id });

  await page.goto('/accounts');
  await page.getByText('HDFC Savings').click();
  const rows = page.getByRole('dialog').getByRole('button').filter({ hasText: String(stamp) });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(`newer-${stamp}`);
  await expect(rows.last()).toContainText(`older-${stamp}`);
});

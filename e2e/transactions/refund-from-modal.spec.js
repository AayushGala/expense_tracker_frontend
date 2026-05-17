import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createExpense, getTransaction,
} from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test.beforeEach(async () => {
  await resetState();
});

test('create a refund from inside the expense detail modal', async ({ page }) => {
  const note = `e2e-refund-flow-${Date.now()}`;
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');

  const expense = await createExpense({
    amount: '500',
    notes: note,
    accountId: hdfc.id,
    categoryId: groceries.id,
  });

  await page.goto('/transactions');
  await page.getByRole('table').getByText(note).click();

  // Click the Refund button in the detail modal — navigates with refund_of.
  await page.getByRole('button', { name: /↩\s*refund/i }).click();
  await expect(page).toHaveURL(new RegExp(`/transactions/new\\?refund_of=${expense.id}`));

  // useRefundMode pre-fills amount + to_account + beneficiary. User adjusts
  // amount to a partial refund.
  await page.getByLabel('Amount').fill('200');
  await page.getByRole('button', { name: /save refund/i }).click();

  await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 15_000 });

  // Verify the new income transaction links back to the expense.
  const txn = await getTransaction(expense.id);
  // Wait for the refund to appear in the listing.
  const listRes = await fetch(`${API_BASE}/api/transactions/?type=income&page_size=50`, {
    headers: { Authorization: `Token ${await tok()}` },
  }).then((r) => r.json());
  const refunds = (listRes.results ?? listRes).filter(
    (t) => t.source_transaction === expense.id,
  );
  expect(refunds.length).toBe(1);
  expect(Number(refunds[0].amount ?? 200)).toBeGreaterThan(0);
});

async function tok() {
  const { getToken } = await import('../helpers/api.js');
  return getToken();
}

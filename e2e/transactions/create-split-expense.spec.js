import { test, expect } from '@playwright/test';
import { resetState, getTransaction } from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

test.beforeEach(async () => {
  await resetState();
});

test('create a split_expense via the UI and verify receivables', async ({ page }) => {
  const uniqueNote = `e2e-split-${Date.now()}`;

  await page.goto('/transactions/new');
  await page.getByRole('button', { name: 'Split Expense' }).click();
  await expect(page.getByRole('button', { name: /save split expense/i })).toBeVisible();

  // Total bill: 900, my share: 300 (custom), 2 others owe 300 each.
  await page.getByLabel('Total Bill Amount').fill('900');
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select account")').first(),
    /HDFC Savings/i,
  );
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select category")').first(),
    /Groceries/i,
  );

  // Total People = 3 (me + 2 others).
  await page.locator('#txn-total-people').fill('3');

  // My share = 300 (custom).
  await page.getByRole('button', { name: /custom amount/i }).click();
  await page.locator('#txn-my-share').fill('300');

  // The form auto-adds the first row; click once more to get to 2 rows.
  await page.getByRole('button', { name: /add person/i }).click();

  const nameInputs = page.getByPlaceholder('Person name');
  const amountInputs = page.getByPlaceholder('₹ amount');
  await nameInputs.nth(0).fill('Rahul');
  await amountInputs.nth(0).fill('300');
  await nameInputs.nth(1).fill('Priya');
  await amountInputs.nth(1).fill('300');

  await page.getByLabel(/notes/i).fill(uniqueNote);
  await page.getByRole('button', { name: /save split expense/i }).click();

  await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('table').getByText(uniqueNote)).toBeVisible();

  // Verify receivables persisted server-side.
  const row = page.getByRole('row').filter({ hasText: uniqueNote }).first();
  await row.click();
  // The detail modal should mention both names; verify via API to keep
  // this independent of modal markup.
  const apiList = await fetch(
    `${process.env.E2E_API_BASE || 'http://localhost:8000'}/api/transactions/?search=${encodeURIComponent(uniqueNote)}`,
    { headers: await authHeaders() },
  ).then((r) => r.json());
  const txnId = (apiList.results ?? apiList)[0].id;
  const txn = await getTransaction(txnId);
  const names = (txn.receivables ?? []).map((r) => r.person_name).sort();
  expect(names).toEqual(['Priya', 'Rahul']);
});

async function authHeaders() {
  const { getToken } = await import('../helpers/api.js');
  const token = await getToken();
  return { Authorization: `Token ${token}` };
}

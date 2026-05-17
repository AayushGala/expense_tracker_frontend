import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createExpense, createSplitExpense,
  getTransaction, getToken,
} from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test.beforeEach(async () => {
  await resetState();
});

async function setup() {
  const accounts = await getAccounts();
  const categories = await getCategories();
  return {
    accounts,
    categories,
    hdfc: accounts.find((a) => a.name === 'HDFC Savings'),
    cash: accounts.find((a) => a.name === 'Cash'),
    icici: accounts.find((a) => a.name === 'ICICI Credit Card'),
    receivableAcct: accounts.find((a) => a.type_name === 'Receivable'),
    groceries: categories.find((c) => c.name === 'Groceries'),
    salary: categories.find((c) => c.name === 'Salary'),
    surcharges: categories.find((c) => c.name === 'Surcharges'),
  };
}

test('split_expense → expense clears orphan receivables', async ({ page }) => {
  const { hdfc, groceries, receivableAcct } = await setup();
  const split = await createSplitExpense({
    totalAmount: '900', myShare: '300',
    accountId: hdfc.id, categoryId: groceries.id,
    receivableAccountId: receivableAcct.id,
    receivables: [
      { person_name: 'Rahul', amount_owed: '300' },
      { person_name: 'Priya', amount_owed: '300' },
    ],
  });
  expect((await getTransaction(split.id)).receivables.length).toBe(2);

  await page.goto(`/transactions/${split.id}/edit`);
  await page.getByRole('button', { name: 'Expense', exact: true }).click();
  await page.getByLabel('Amount').fill('200');
  // From + category carry over from split, but verify they're set; if the
  // category dropdown reset, pick again. Most users wouldn't repick.
  await page.getByRole('button', { name: /update expense/i }).click();

  await expect(page.getByText(/transaction updated/i)).toBeVisible({ timeout: 15_000 });
  const updated = await getTransaction(split.id);
  expect(updated.type).toBe('expense');
  expect(updated.receivables.length).toBe(0);
});

test('split_expense → transfer clears orphan receivables', async ({ page }) => {
  const { hdfc, cash, groceries, receivableAcct } = await setup();
  const split = await createSplitExpense({
    totalAmount: '1200', myShare: '400',
    accountId: hdfc.id, categoryId: groceries.id,
    receivableAccountId: receivableAcct.id,
    receivables: [{ person_name: 'Anjali', amount_owed: '800' }],
  });

  await page.goto(`/transactions/${split.id}/edit`);
  await page.getByRole('button', { name: 'Transfer' }).click();
  await page.getByLabel('Amount').fill('500');
  // To Account is empty after the switch — pick Cash.
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select destination account")').first(),
    /Cash/i,
  );
  await page.getByRole('button', { name: /update transfer/i }).click();

  await expect(page.getByText(/transaction updated/i)).toBeVisible({ timeout: 15_000 });
  const updated = await getTransaction(split.id);
  expect(updated.type).toBe('transfer');
  expect(updated.receivables.length).toBe(0);
});

test('transfer-with-fee → transfer-no-fee drops the fee entry', async ({ page }) => {
  const { hdfc, cash, surcharges } = await setup();
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api/transactions/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'transfer', date: '2026-05-17', amount: '1000',
      from_account_id: hdfc.id, to_account_id: cash.id,
      fee: '18', fee_category_id: surcharges.id,
    }),
  });
  const txn = await res.json();
  expect((await getTransaction(txn.id)).entries.length).toBe(3);

  await page.goto(`/transactions/${txn.id}/edit`);
  // Clear the fee field. AmountInput for fee uses id 'txn-fee'.
  await page.locator('#txn-fee').fill('');
  await page.getByRole('button', { name: /update transfer/i }).click();

  await expect(page.getByText(/transaction updated/i)).toBeVisible({ timeout: 15_000 });
  const updated = await getTransaction(txn.id);
  expect(updated.entries.length).toBe(2);
});

test('expense → income (user correction)', async ({ page }) => {
  const { hdfc, groceries, salary } = await setup();
  const expense = await createExpense({
    amount: '500',
    notes: `e2e-convert-${Date.now()}`,
    accountId: hdfc.id, categoryId: groceries.id,
  });

  await page.goto(`/transactions/${expense.id}/edit`);
  await page.getByRole('button', { name: 'Income' }).click();
  // Category resets when switching expense↔income because the category sets
  // differ; pick a Salary category.
  // Income category dropdown reads "Select..." because Select adds the
  // placeholder as an option rather than as the trigger's display text.
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select...")').first(),
    /Salary/i,
  );
  await page.getByRole('button', { name: /update income/i }).click();

  await expect(page.getByText(/transaction updated/i)).toBeVisible({ timeout: 15_000 });
  const updated = await getTransaction(expense.id);
  expect(updated.type).toBe('income');
  // The bank account should now be the destination (debit) of the income.
  const debit = updated.entries.find((e) => e.entry_type === 'DEBIT' && e.account);
  expect(debit.account).toBe(hdfc.id);
});

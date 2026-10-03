import { test, expect } from '@playwright/test';
import { resetState, getAccounts, getCategories, createExpense } from './helpers/api.js';

const MASK = '₹ ••••••';

test.beforeEach(async () => {
  await resetState();
});

test.afterEach(async () => {
  // resetState also reopens the book-close made below.
  await resetState();
});

test('hiding amounts on the Dashboard survives a reload and applies to Accounts and Transactions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(MASK)).toHaveCount(0);

  await page.getByRole('button', { name: 'Hide amounts' }).click();
  // Net worth, its breakdown and this month's spend are all masked; with no
  // transactions after reset, no ₹ figure is left on the page.
  await expect(page.getByText(MASK).first()).toBeVisible();
  await expect(page.getByText(/₹\d/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Show amounts' })).toBeVisible();
  await expect(page.getByText(MASK).first()).toBeVisible();
  await expect(page.getByText(/₹\d/)).toHaveCount(0);

  await page.goto('/accounts');
  await expect(page.getByText('HDFC Savings')).toBeVisible();
  await expect(page.getByText(/₹\d/)).toHaveCount(0);

  // Spent / Received / Net on the Transactions summary.
  await page.goto('/transactions');
  await expect(page.getByText(MASK)).toHaveCount(3);

  await page.getByRole('button', { name: 'Show amounts' }).click();
  await expect(page.getByText(MASK)).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Hide amounts' })).toBeVisible();
  await expect(page.getByText(MASK)).toHaveCount(0);
});

test('hidden amounts also mask account balances, account history and book-close net worth', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  const accounts = await getAccounts();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = (await getCategories()).find((c) => c.name === 'Groceries');
  await createExpense({ amount: 321, accountId: hdfc.id, categoryId: groceries.id });

  await page.addInitScript(() => localStorage.setItem('hideAmounts', '1'));

  // Accounts: summary, section totals and every account card — no ₹ figure left.
  await page.goto('/accounts');
  await expect(page.getByText('HDFC Savings')).toBeVisible();
  await expect(page.getByText(/₹\d/)).toHaveCount(0);

  // Ledger modal: balance masked (individual entries stay visible).
  await page.getByText('HDFC Savings').click();
  await expect(page.getByText('Current Balance').locator('..')).toContainText(MASK);

  // Reports → Account History: stats and running balances masked.
  await page.goto('/reports');
  await page.getByRole('button', { name: 'Account History' }).click();
  await expect(page.getByText('Current Balance').locator('..')).toContainText(MASK);
  await expect(page.getByText(/Bal: ₹\d/)).toHaveCount(0);

  // Settings → Book Closing: the close's net worth is masked.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Book Closing' }).click();
  await page.getByRole('button', { name: 'Close Books' }).click();
  await expect(page.getByText(/Books closed through/)).toBeVisible();
  await expect(page.getByText(`Net worth ${MASK}`)).toBeVisible();
});

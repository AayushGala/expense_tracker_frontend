import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createSplitExpense,
} from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

test.beforeEach(async () => {
  await resetState();
});

test('a person owing on two splits is written off in one go from the People page', async ({ page }) => {
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const receivableAcct = accounts.find((a) => a.type_name === 'Receivable');

  for (const [amount, notes] of [['600', 'Dinner'], ['400', 'Movie']]) {
    await createSplitExpense({
      totalAmount: amount, myShare: '0',
      accountId: hdfc.id, categoryId: groceries.id, receivableAccountId: receivableAcct.id,
      receivables: [{ person_name: 'Rahul', amount_owed: amount }], notes,
    });
  }

  await page.goto('/people');
  const card = page.locator('div', { hasText: 'Rahul' }).filter({ hasText: 'owes you' }).first();
  await expect(card.getByText('₹1,000.00').first()).toBeVisible();
  await expect(card.getByText('Dinner')).toBeVisible();
  await expect(card.getByText('Movie')).toBeVisible();

  await card.getByRole('button', { name: 'Write off' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Write off · Rahul/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/settled with rahul/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Settled \(1\)/ }).click();
  // Settled people start collapsed; open the history.
  await page.getByText('Rahul', { exact: true }).click();
  await expect(page.getByText('Written off')).toBeVisible();
});

test('money from a person, then spending for them, nets into one balance', async ({ page }) => {
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');
  const receivableAcct = accounts.find((a) => a.type_name === 'Receivable');

  await page.goto('/people');
  await page.getByRole('link', { name: /money with a person/i }).click();
  await page.locator('#txn-person').fill('Janki');
  await page.locator('#txn-amount').fill('1000');
  await pickFromDropdown(page, page.locator('button:has-text("Select account")').first(), /HDFC Savings/i);
  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 15_000 });

  await createSplitExpense({
    totalAmount: '700', myShare: '0',
    accountId: hdfc.id, categoryId: groceries.id, receivableAccountId: receivableAcct.id,
    receivables: [{ person_name: 'Janki', amount_owed: '700' }], notes: 'Her groceries',
  });

  await page.goto('/people');
  const card = page.locator('div', { hasText: 'Janki' }).filter({ hasText: 'you owe' }).first();
  await expect(card.getByText('₹300.00').first()).toBeVisible();

  await card.getByRole('button', { name: 'Money sent' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[type="number"]')).toHaveValue('300');
  await pickFromDropdown(page, dialog.locator('button:has-text("Select account")').first(), /HDFC Savings/i);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/settled with janki/i)).toBeVisible({ timeout: 15_000 });
});

test('paying for someone from the People page raises their balance without counting as spending', async ({ page }) => {
  await page.goto('/people');
  await page.getByRole('link', { name: /money with a person/i }).click();
  await page.locator('#txn-person').fill('Riya');
  await page.getByRole('button', { name: 'Paid for them' }).click();
  await page.locator('#txn-amount').fill('450');
  await pickFromDropdown(page, page.locator('button:has-text("Select account")').first(), /ICICI Credit Card/i);
  await pickFromDropdown(page, page.locator('button:has-text("Not recorded")').first(), /Groceries/i);
  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 15_000 });

  await page.goto('/people');
  const card = page.locator('div', { hasText: 'Riya' }).filter({ hasText: 'owes you' }).first();
  await expect(card.getByText('₹450.00').first()).toBeVisible();
  await expect(card.getByText('Paid for their Groceries')).toBeVisible();

  await page.goto('/transactions');
  await expect(page.getByText('Spent (self)').locator('..').getByText('₹0.00')).toBeVisible();
  await expect(page.getByText('To person').first()).toBeVisible();
});

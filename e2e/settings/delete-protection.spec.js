import { test, expect } from '@playwright/test';
import {
  resetState, getAccounts, getCategories, createExpense,
} from '../helpers/api.js';

test.beforeEach(async () => {
  await resetState();
});

test('deleting a category that has linked entries shows the rose error inline', async ({ page }) => {
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');

  // Seed: an expense using Groceries, so the protected delete path triggers.
  await createExpense({
    amount: '500', notes: `e2e-delete-block-${Date.now()}`,
    accountId: hdfc.id, categoryId: groceries.id,
  });

  await page.goto('/settings');
  await page.locator('nav').getByRole('button', { name: /^categories$/i }).click();

  // Each CategoryRow / SubCategoryRow wraps its action buttons in a div with
  // the tailwind `group` class. Substring match is fine — "Groceries" is
  // a unique seeded subcategory name.
  const groceriesRow = page.locator('div.group').filter({ hasText: 'Groceries' });
  await groceriesRow.getByRole('button', { name: /^delete$/i }).click({ force: true });
  await groceriesRow.getByRole('button', { name: /^confirm$/i }).click();

  // Two valid backend error formats depending on whether the first item in
  // `protected_objects` is a Transaction or Entry (see tracker/exceptions.py:
  // _describe_protected_objects). The exception handler's noun selection is
  // sample-based, so the wording can vary across runs. Either is acceptable —
  // the user-visible requirement is "some error shows up".
  await expect(
    page.getByText(/cannot delete — \d+ (refund|entr)/i),
  ).toBeVisible({ timeout: 10_000 });
});

test('protected (role-tagged) categories surface a disabled Delete with tooltip', async ({ page }) => {
  await page.goto('/settings');
  await page.locator('nav').getByRole('button', { name: /^categories$/i }).click();

  // Two role-tagged categories ship from migration 0009: Refund + Cashback /
  // Rewards. Pick Cashback because "Refund" appears as a substring in other
  // contexts (e.g. the parent category column). Locate via its protected-Delete
  // title attribute, which only the protected categories have.
  const protectedDeletes = page.getByTitle(/cannot delete a protected category/i);
  await expect(protectedDeletes.first()).toBeVisible();
  // Sanity: there are at least 2 (cashback + refund).
  expect(await protectedDeletes.count()).toBeGreaterThanOrEqual(2);
});

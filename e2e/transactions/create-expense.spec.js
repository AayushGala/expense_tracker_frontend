import { test, expect } from '@playwright/test';
import { resetState } from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

test.beforeEach(async () => {
  await resetState();
});

test('create an expense via the UI and see it in the transactions list', async ({ page }) => {
  const uniqueNote = `e2e-expense-${Date.now()}`;

  await page.goto('/transactions');
  await page.getByRole('button', { name: /add transaction/i }).click();
  await expect(page).toHaveURL(/\/transactions\/new$/);

  // Default type is 'expense'; confirm the form is in expense mode.
  await expect(page.getByRole('button', { name: /save expense/i })).toBeVisible();

  await page.getByLabel('Amount').fill('500');

  // Paid From — Dropdown trigger initially reads 'Select account'.
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select account")').first(),
    /HDFC Savings/i,
  );

  // Category dropdown initially reads 'Select category'.
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select category")').first(),
    /Groceries/i,
  );

  await page.getByLabel(/notes/i).fill(uniqueNote);
  await page.getByRole('button', { name: /save expense/i }).click();

  // The toast appears once the API responds — sync on that before asserting
  // on the redirected list, which might lag behind on a cold server.
  await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/transactions$/);
  // Desktop view: scope to the table so the hidden mobile card duplicate
  // doesn't interfere.
  await expect(page.getByRole('table').getByText(uniqueNote)).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { resetState } from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

test.beforeEach(async () => {
  await resetState();
});

test('create an income via the UI', async ({ page }) => {
  const uniqueNote = `e2e-income-${Date.now()}`;

  await page.goto('/transactions/new');
  await page.getByRole('button', { name: 'Income' }).click();

  await expect(page.getByRole('button', { name: /save income/i })).toBeVisible();
  await page.getByLabel('Amount').fill('50000');

  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select account")').first(),
    /HDFC Savings/i,
  );
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select category")').first(),
    /Salary/i,
  );

  await page.getByLabel(/notes/i).fill(uniqueNote);
  await page.getByRole('button', { name: /save income/i }).click();

  await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole('table').getByText(uniqueNote)).toBeVisible();
});

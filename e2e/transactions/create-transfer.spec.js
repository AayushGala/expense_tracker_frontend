import { test, expect } from '@playwright/test';
import { resetState } from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

test.beforeEach(async () => {
  await resetState();
});

test('create a transfer via the UI', async ({ page }) => {
  const uniqueNote = `e2e-transfer-${Date.now()}`;

  await page.goto('/transactions/new');
  await page.getByRole('button', { name: 'Transfer' }).click();

  await expect(page.getByRole('button', { name: /save transfer/i })).toBeVisible();
  await page.getByLabel('Amount').fill('5000');

  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select source account")').first(),
    /HDFC Savings/i,
  );
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select destination account")').first(),
    /Cash/i,
  );

  await page.getByLabel(/notes/i).fill(uniqueNote);
  await page.getByRole('button', { name: /save transfer/i }).click();

  await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('table').getByText(uniqueNote)).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { resetState } from '../helpers/api.js';
import { pickFromDropdown } from '../helpers/ui.js';

test.beforeEach(async () => {
  await resetState();
});

test('create a bill_payment via the UI', async ({ page }) => {
  const uniqueNote = `e2e-billpay-${Date.now()}`;

  await page.goto('/transactions/new');
  await page.getByRole('button', { name: 'Bill Payment' }).click();

  await expect(page.getByRole('button', { name: /save bill payment/i })).toBeVisible();
  await page.getByLabel('Amount').fill('15000');

  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select bank account")').first(),
    /HDFC Savings/i,
  );
  await pickFromDropdown(
    page,
    page.locator('button:has-text("Select liability account")').first(),
    /ICICI Credit Card/i,
  );

  await page.getByLabel(/notes/i).fill(uniqueNote);
  await page.getByRole('button', { name: /save bill payment/i }).click();

  await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('table').getByText(uniqueNote)).toBeVisible();
});

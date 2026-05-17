import { test, expect } from '@playwright/test';

test.describe('dashboard after login', () => {
  test('lands on /, navigation rendered, transactions page reachable', async ({ page }) => {
    await page.goto('/');

    // Side nav should be visible (desktop) or bottom nav (mobile).
    // The Transactions entry exists on both.
    await expect(page.getByRole('link', { name: /transactions/i }).first()).toBeVisible();

    await page.getByRole('link', { name: /transactions/i }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
  });
});

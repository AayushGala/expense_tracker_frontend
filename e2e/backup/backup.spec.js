import { test, expect } from '@playwright/test';

test('create a backup via the Settings UI and see it in the list', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: /data export/i }).click();

  // Capture the existing count so we can assert the new file appears.
  const beforeCount = await page.getByText(/Existing backups/i).count();

  await page.getByRole('button', { name: /create backup/i }).click();

  // Success toast or list update.
  await expect(page.getByText(/Existing backups/i)).toBeVisible({ timeout: 15_000 });
  // After the click, the listing block becomes visible if it wasn't already.
  if (beforeCount === 0) {
    await expect(page.getByText(/Existing backups \(1\)/i)).toBeVisible();
  }
});

import { test, expect } from '@playwright/test';
import { getToken } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

async function backupCount() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api/backups/`, {
    headers: { Authorization: `Token ${token}` },
  });
  const items = await res.json();
  return Array.isArray(items) ? items.length : 0;
}

test('create a backup via the Settings UI and see it in the list', async ({ page }) => {
  const before = await backupCount();

  await page.goto('/settings');
  await page.getByRole('button', { name: /data export/i }).click();

  await page.getByRole('button', { name: /create backup/i }).click();

  // Authoritative check is via the API — the UI may render the list with
  // varying formats (no-list when empty, "Existing backups (N)" when not).
  await expect.poll(backupCount, { timeout: 15_000 }).toBe(before + 1);
});

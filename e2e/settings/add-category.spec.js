import { test, expect } from '@playwright/test';
import { getToken } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test('add a category via the Settings UI', async ({ page }) => {
  const categoryName = `E2E Cat ${Date.now()}`;

  await page.goto('/settings');
  // Categories is the default tab; we still click to make the test resilient
  // to the default changing later.
  await page.locator('nav').getByRole('button', { name: /^categories$/i }).click();

  await page.getByPlaceholder('Category name').fill(categoryName);
  await page.getByRole('main').getByRole('button', { name: /^add$/i }).click();

  const token = await getToken();
  await expect.poll(async () => {
    const res = await fetch(`${API_BASE}/api/categories/?page_size=200`, {
      headers: { Authorization: `Token ${token}` },
    }).then((r) => r.json());
    return (res.results ?? res).map((c) => c.name);
  }, { timeout: 10_000 }).toContain(categoryName);

  // Cleanup.
  const list = await fetch(`${API_BASE}/api/categories/?page_size=200`, {
    headers: { Authorization: `Token ${token}` },
  }).then((r) => r.json());
  const created = (list.results ?? list).find((c) => c.name === categoryName);
  if (created) {
    await fetch(`${API_BASE}/api/categories/${created.id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Token ${token}` },
    });
  }
});

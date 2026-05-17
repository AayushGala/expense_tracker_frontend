import { test, expect } from '@playwright/test';
import { getToken } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test('add an account via the Settings UI', async ({ page }) => {
  const accountName = `E2E Acct ${Date.now()}`;

  await page.goto('/settings');
  // The desktop sidebar nav has buttons for each section; scope to it so we
  // don't match the global "+ Add" header button or other "Accounts" entries.
  await page.locator('nav').getByRole('button', { name: /^accounts$/i }).click();

  await page.getByPlaceholder('Account name').fill(accountName);
  // The Account type Dropdown has no default value — open it and pick the
  // first option (Asset) so the POST body has a valid type FK.
  const dropdowns = page.locator('button[aria-haspopup="listbox"]');
  await dropdowns.first().click();
  await page.getByRole('option').first().click();
  await page.getByRole('main').getByRole('button', { name: /^add$/i }).click();

  // Confirm via API (more reliable than UI scraping).
  const token = await getToken();
  await expect.poll(async () => {
    const res = await fetch(`${API_BASE}/api/accounts/`, {
      headers: { Authorization: `Token ${token}` },
    }).then((r) => r.json());
    return (res.results ?? res).map((a) => a.name);
  }, { timeout: 10_000 }).toContain(accountName);

  // Cleanup so re-runs stay clean.
  const list = await fetch(`${API_BASE}/api/accounts/`, {
    headers: { Authorization: `Token ${token}` },
  }).then((r) => r.json());
  const created = (list.results ?? list).find((a) => a.name === accountName);
  if (created) {
    await fetch(`${API_BASE}/api/accounts/${created.id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Token ${token}` },
    });
  }
});

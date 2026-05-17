import { test, expect } from '@playwright/test';
import { resetState, getToken, getAccounts, getCategories } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test.beforeEach(async () => {
  await resetState();
});

test('confirm a parsed SMS via the drawer creates a linked transaction', async ({ page }) => {
  const token = await getToken();
  const accounts = await getAccounts();
  const categories = await getCategories();
  const hdfc = accounts.find((a) => a.name === 'HDFC Savings');
  const groceries = categories.find((c) => c.name === 'Groceries');

  const stamp = Date.now();
  const body = `e2e drawer ${stamp}: Rs 500 debited at Swiggy`;
  // Seed an SMS that's already "parsed" — drawer's Confirm button is gated
  // on parsed_amount != null + transaction == null.
  const seedRes = await fetch(`${API_BASE}/api/sms/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: 'AD-HDFCBK', body,
      received_at: new Date().toISOString(),
      device_identifier: 'phone1',
    }),
  });
  const seeded = await seedRes.json();
  await fetch(`${API_BASE}/api/sms/${seeded.id}/`, {
    method: 'PATCH',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'parsed',
      parsed_amount: '500.00',
      parsed_direction: 'debit',
      parsed_account: hdfc.id,
      parsed_category: groceries.id,
      parsed_date: '2026-05-17',
    }),
  });

  const noteMarker = `e2e-drawer-${stamp}`;

  await page.goto('/sms');
  await page.getByRole('table').getByText(body.slice(0, 40)).click();

  // Drawer opens; Expense type is selected by default (parsed_direction='debit').
  // Fill Notes with the marker so we can find the transaction afterward.
  await page.getByPlaceholder('Optional').fill(noteMarker);
  await page.getByRole('button', { name: /^confirm$/i }).click();

  await expect(page.getByText(/sms confirmed as transaction/i)).toBeVisible({ timeout: 15_000 });

  const apiList = await fetch(
    `${API_BASE}/api/transactions/?search=${encodeURIComponent(noteMarker)}`,
    { headers: { Authorization: `Token ${token}` } },
  ).then((r) => r.json());
  const rows = apiList.results ?? apiList;
  expect(rows.length).toBe(1);

  const smsRes = await fetch(`${API_BASE}/api/sms/${seeded.id}/`, {
    headers: { Authorization: `Token ${token}` },
  }).then((r) => r.json());
  expect(smsRes.status).toBe('confirmed');
  expect(smsRes.transaction).toBe(rows[0].id);
});

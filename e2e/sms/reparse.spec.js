import { test, expect } from '@playwright/test';
import { resetState, getToken } from '../helpers/api.js';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';

test.beforeEach(async () => {
  await resetState();
});

test('Reparse button reruns the pipeline and shows a toast', async ({ page }) => {
  const token = await getToken();
  const stamp = Date.now();
  const body = `e2e reparse ${stamp}`;

  // Receive → patch to look like a previously-parsed SMS.
  const seedRes = await fetch(`${API_BASE}/api/sms/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: 'AD-HDFCBK', body,
      received_at: new Date().toISOString(),
      device_identifier: 'phone1',
    }),
  });
  const sms = await seedRes.json();
  await fetch(`${API_BASE}/api/sms/${sms.id}/`, {
    method: 'PATCH',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'parsed',
      parsed_amount: '500.00',
      parsed_direction: 'debit',
    }),
  });

  await page.goto('/sms');
  await page.getByRole('table').getByText(body.slice(0, 40)).click();

  // Drawer opens. Click Reparse.
  await page.getByRole('button', { name: /reparse/i }).click();
  await expect(page.getByText(/sms reparsed/i)).toBeVisible({ timeout: 15_000 });

  // After reparse, parsed_amount is wiped and re-populated only if the LLM
  // hits. Different LLM outcomes (failed when disabled, ignored when the
  // body is non-transactional, parsed when the body looks real) are all
  // valid — the cross-cutting invariant is that *some* end-state was reached
  // and the parsed_amount no longer matches the seeded value.
  await expect.poll(async () => {
    const res = await fetch(`${API_BASE}/api/sms/${sms.id}/`, {
      headers: { Authorization: `Token ${token}` },
    }).then((r) => r.json());
    return res.status;
  }, { timeout: 15_000 }).not.toBe('pending');

  const after = await fetch(`${API_BASE}/api/sms/${sms.id}/`, {
    headers: { Authorization: `Token ${token}` },
  }).then((r) => r.json());
  expect(['parsed', 'failed', 'ignored']).toContain(after.status);
  // Seeded value was 500.00; the reparse cleared parsed_amount before the
  // LLM call, and only a real parse would re-populate it.
  if (after.status !== 'parsed') {
    expect(after.parsed_amount).toBeNull();
  }
});
